#!/bin/bash
# Mainnet launch sequence for CryptoBulls.
#
# Usage:
#   1. Launch $BULLS on pump.fun manually, get the mint address.
#   2. ssh root@<bulls-box>
#   3. SCP your mainnet deployer keypair onto the box temporarily
#      (e.g. /tmp/mainnet-deployer.json), or use any local path.
#   4. DEPLOYER_KEYPAIR=/tmp/mainnet-deployer.json \
#        /root/bullpeg-sol/scripts/launch.sh <BULLS_MINT_ADDRESS>
#   5. After successful launch, shred the keypair file:
#      shred -u /tmp/mainnet-deployer.json
#
# This script:
#   - Verifies prerequisites (deployer pubkey, balance, build artifact, anchor.toml)
#   - Deploys the program to mainnet-beta
#   - Calls initialize with the provided mint
#   - Updates web service env to mainnet
#   - Smoke-tests the live site
#
# Idempotent guards:
#   - Refuses to proceed if deployer pubkey doesn't match expected
#   - Refuses to deploy if the program is already deployed at this ID
#   - Refuses to initialize if the BullBank PDA already exists
#   - Logs every step to /root/launch-mainnet.log
#
# Env vars (override defaults):
#   DEPLOYER_KEYPAIR  - path to the mainnet deployer JSON keypair
#                       (default: /root/.config/solana/id.json — the devnet wallet,
#                        which will FAIL the pubkey-match guard on mainnet)
#   EXPECTED_DEPLOYER - the deployer pubkey we expect (default below)

set -euo pipefail
exec > >(tee -a /root/launch-mainnet.log) 2>&1
echo "=== $(date -u +"%Y-%m-%dT%H:%M:%SZ") LAUNCH START ==="

if [ -z "${1:-}" ]; then
  echo "ERROR: Pass the \$BULLS mint address as the first argument."
  echo "Usage: DEPLOYER_KEYPAIR=/path/to/keypair.json $0 <BULLS_MINT_ADDRESS>"
  exit 1
fi
BULLS_MINT="$1"

# Sanity check: 32-44 char base58
if ! echo "$BULLS_MINT" | grep -qE "^[1-9A-HJ-NP-Za-km-z]{32,44}$"; then
  echo "ERROR: '$BULLS_MINT' doesn't look like a valid mint address."
  exit 1
fi

# Mainnet deployer keypair (must hold ~5.5 SOL on mainnet)
KEYPAIR="${DEPLOYER_KEYPAIR:-$HOME/.config/solana/id.json}"
EXPECTED_DEPLOYER="${EXPECTED_DEPLOYER:-FRZJpAtPcWJBRFziY6dZkBHMBSWVi12hXAtAJEHawTwQ}"

if [ ! -f "$KEYPAIR" ]; then
  echo "ERROR: keypair not found at $KEYPAIR"
  echo "Set DEPLOYER_KEYPAIR=/path/to/your/mainnet-deployer.json and re-run."
  exit 1
fi

. "$HOME/.cargo/env"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

cd /root/bullpeg-sol

# ============================================================
# Step 0 — Pre-flight
# ============================================================
echo ""
echo "=== Step 0: pre-flight checks ==="

solana config set --url mainnet-beta --keypair "$KEYPAIR" > /dev/null
DEPLOYER=$(solana address --keypair "$KEYPAIR")
echo "deployer pubkey: $DEPLOYER"
echo "expected:        $EXPECTED_DEPLOYER"

if [ "$DEPLOYER" != "$EXPECTED_DEPLOYER" ]; then
  echo "ERROR: keypair pubkey ($DEPLOYER) does not match EXPECTED_DEPLOYER ($EXPECTED_DEPLOYER)."
  echo "If you intentionally changed deployers, set EXPECTED_DEPLOYER=$DEPLOYER and re-run."
  exit 1
fi

BALANCE=$(solana balance --keypair "$KEYPAIR" | awk '{print $1}')
echo "balance:         $BALANCE SOL"
echo "BULLS mint:      $BULLS_MINT"

# Need >= 5 SOL for deploy
BALANCE_INT=$(printf "%.0f" "$BALANCE")
if [ "$BALANCE_INT" -lt 5 ]; then
  echo "ERROR: deployer needs >= 5 SOL on mainnet. Currently: $BALANCE"
  exit 1
fi

# Build artifact must exist
if [ ! -f target/deploy/bullpeg.so ]; then
  echo "ERROR: target/deploy/bullpeg.so missing. Run 'anchor build' first."
  exit 1
fi
echo "build artifact:  $(ls -la target/deploy/bullpeg.so | awk '{print $5}') bytes"

# Anchor.toml must have a mainnet entry
if ! grep -q "^\[programs.mainnet\]" Anchor.toml; then
  echo "ERROR: Anchor.toml missing [programs.mainnet] section."
  exit 1
fi
PROGRAM_ID=$(solana address -k target/deploy/bullpeg-keypair.json)
ANCHOR_MAINNET_ID=$(awk '/^\[programs.mainnet\]/{f=1; next} /^\[/{f=0} f && /^bullpeg/' Anchor.toml | sed 's/.*"\(.*\)".*/\1/')
if [ "$PROGRAM_ID" != "$ANCHOR_MAINNET_ID" ]; then
  echo "ERROR: program keypair ID ($PROGRAM_ID) != Anchor.toml mainnet ID ($ANCHOR_MAINNET_ID)"
  echo "Run 'anchor keys sync' and rebuild before running this script."
  exit 1
fi
echo "program ID:      $PROGRAM_ID (matches Anchor.toml)"

# ============================================================
# Step 1 — Deploy program (skip if already deployed at this ID)
# ============================================================
echo ""
echo "=== Step 1: deploy program ==="

if solana program show "$PROGRAM_ID" --url mainnet-beta 2>/dev/null | grep -q "Authority"; then
  echo "Program $PROGRAM_ID is already deployed on mainnet. Skipping deploy."
else
  echo "Deploying (this takes ~60s and burns ~5 SOL)..."
  anchor deploy --provider.cluster mainnet-beta --provider.wallet "$KEYPAIR"
  echo "Deploy success."
fi

solana program show "$PROGRAM_ID" --url mainnet-beta | head -8

# ============================================================
# Step 2 — Initialize (skip if bank PDA already exists)
# ============================================================
echo ""
echo "=== Step 2: initialize bank with $BULLS mint ==="

# Compute Bank PDA off-chain to check existence
BANK_PDA=$(node -e "
const w3 = require(require.resolve('@solana/web3.js', { paths: ['/root/bullpeg-sol'] }));
const { PublicKey } = w3;
const PROG = new PublicKey('$PROGRAM_ID');
const [pda] = PublicKey.findProgramAddressSync([Buffer.from('bank')], PROG);
console.log(pda.toBase58());
")
echo "bank PDA:        $BANK_PDA"

if solana account "$BANK_PDA" --url mainnet-beta 2>/dev/null | grep -q "Balance"; then
  echo "BullBank already initialized. Skipping initialize."
else
  ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com \
  ANCHOR_WALLET="$KEYPAIR" \
    npx ts-node scripts/devnet_initialize.ts "$BULLS_MINT"
fi

# ============================================================
# Step 3 — Update web service env to mainnet + restart
# ============================================================
echo ""
echo "=== Step 3: switch web service to mainnet ==="

UNIT=/etc/systemd/system/cryptobulls-web.service
if grep -q "NEXT_PUBLIC_SOLANA_CLUSTER=devnet" "$UNIT"; then
  # Swap devnet → mainnet in URLs while preserving any API keys (Helius etc.)
  CURRENT_PUB=$(grep "^Environment=NEXT_PUBLIC_SOLANA_RPC_URL=" "$UNIT" | sed 's/^Environment=NEXT_PUBLIC_SOLANA_RPC_URL=//')
  CURRENT_SRV=$(grep "^Environment=SOLANA_RPC_URL=" "$UNIT" | sed 's/^Environment=SOLANA_RPC_URL=//')
  NEW_PUB=$(echo "$CURRENT_PUB" | sed -e 's|devnet\.helius-rpc|mainnet.helius-rpc|' -e 's|api\.devnet\.solana\.com|api.mainnet-beta.solana.com|')
  NEW_SRV=$(echo "$CURRENT_SRV" | sed -e 's|devnet\.helius-rpc|mainnet.helius-rpc|' -e 's|api\.devnet\.solana\.com|api.mainnet-beta.solana.com|')

  sed -i "s|^Environment=NEXT_PUBLIC_PROGRAM_ID=.*|Environment=NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID|" "$UNIT"
  sed -i "s|^Environment=NEXT_PUBLIC_SOLANA_CLUSTER=.*|Environment=NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta|" "$UNIT"
  sed -i "s|^Environment=NEXT_PUBLIC_SOLANA_RPC_URL=.*|Environment=NEXT_PUBLIC_SOLANA_RPC_URL=$NEW_PUB|" "$UNIT"
  sed -i "s|^Environment=SOLANA_RPC_URL=.*|Environment=SOLANA_RPC_URL=$NEW_SRV|" "$UNIT"
  systemctl daemon-reload
  systemctl restart cryptobulls-web
  sleep 4
fi
systemctl is-active cryptobulls-web
curl -s --max-time 10 -o /dev/null -w "  / -> %{http_code}\n" --resolve cryptobulls.fun:443:127.0.0.1 https://cryptobulls.fun/ || true
curl -s --max-time 10 -o /dev/null -w "  /api/health -> %{http_code}\n" --resolve cryptobulls.fun:443:127.0.0.1 https://cryptobulls.fun/api/health || true

# ============================================================
# Done
# ============================================================
echo ""
echo "=== $(date -u +"%Y-%m-%dT%H:%M:%SZ") LAUNCH COMPLETE ==="
echo ""
echo "PROGRAM_ID  = $PROGRAM_ID"
echo "BULLS_MINT  = $BULLS_MINT"
echo "BANK_PDA    = $BANK_PDA"
echo "DEPLOYER    = $DEPLOYER"
echo ""
echo "Verify on Solana Explorer:"
echo "  https://explorer.solana.com/address/$PROGRAM_ID"
echo "  https://explorer.solana.com/address/$BULLS_MINT"
echo "  https://explorer.solana.com/address/$BANK_PDA"
echo ""
echo "Next: tweet the launch + monitor the first wraps."
