// Quick script to test Google Drive sharing end-to-end.
// Usage: node api/_lib/_test-drive-share.js <email>
const { shareProductAccess } = require('./_google-drive.js');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node api/_lib/_test-drive-share.js <email>');
  process.exit(1);
}

async function main() {
  console.log(`Testing Drive sharing for blueprint → ${email}...\n`);
  const result = await shareProductAccess({ baseSlug: 'blueprint', email });
  console.log(JSON.stringify(result, null, 2));

  if (result.skipped) {
    console.log('\nFAILED — sharing was skipped (reason:', result.reason, ')');
    process.exit(1);
  }

  if (result.alreadyShared) {
    console.log('\nOK — permission already existed.');
  } else {
    console.log('\nOK — folder shared successfully.');
  }
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
