const required = [
  'VITE_SHOP_NAME',
  'VITE_USER1_LABEL',
  'VITE_USER1_COLOR',
  'VITE_USER1_BANK',
  'VITE_USER1_HOLDER',
  'VITE_USER1_ACCOUNT',
  'VITE_USER2_LABEL',
  'VITE_USER2_COLOR',
  'VITE_USER2_BANK',
  'VITE_USER2_HOLDER',
  'VITE_USER2_ACCOUNT',
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  console.error(`Missing GitHub variables or secrets: ${missing.join(', ')}`);
  process.exit(1);
}

for (const id of ['1', '2']) {
  const account = process.env[`VITE_USER${id}_ACCOUNT`] ?? '';
  if (!/^[0-9 -]+$/.test(account) || !/^\d{8,20}$/.test(account.replace(/\D/g, ''))) {
    console.error(`VITE_USER${id}_ACCOUNT must contain 8-20 digits with optional spaces or hyphens.`);
    process.exit(1);
  }

  const color = process.env[`VITE_USER${id}_COLOR`] ?? '';
  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    console.error(`VITE_USER${id}_COLOR must be a six-digit hex color such as #155E75.`);
    process.exit(1);
  }
}

if (process.env.VITE_USER1_COLOR === process.env.VITE_USER2_COLOR) {
  console.error('User colors must be different.');
  process.exit(1);
}

console.log('Deployment configuration is valid.');
