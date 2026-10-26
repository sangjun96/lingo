import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { hashPassword } from 'better-auth/crypto';

const target = process.argv[2];
if (target !== 'local' && target !== 'remote') {
	throw new Error('Usage: bun run account:create:local|account:create:remote');
}

const localAuthDbId = '00000000-0000-4000-8000-000000000001';
const databaseId = target === 'local' ? localAuthDbId : process.env.AUTH_DB_ID;
if (!databaseId) throw new Error('Set AUTH_DB_ID first.');

const prompt = createInterface({ input: process.stdin, output: process.stdout, terminal: false });
try {
	const email = (await prompt.question('Email: ')).trim().toLowerCase();
	const name = (await prompt.question('Name: ')).trim();
	const password = await prompt.question('Password: ');
	if (!email || !name || !password) throw new Error('Email, name, and password are required.');

	const userId = crypto.randomUUID();
	const now = Date.now();
	const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
	const sql = [
		`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (${quote(userId)}, ${quote(name)}, ${quote(email)}, 0, ${now}, ${now})`,
		`INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (${quote(crypto.randomUUID())}, ${quote(userId)}, 'credential', ${quote(userId)}, ${quote(await hashPassword(password))}, ${now}, ${now})`,
	].join(';\n');

	const args = ['d1', 'raw', databaseId, '--sql', sql];
	if (target === 'local') args.push('--local', '--persist-to', '.cloudflare/state');
	execFileSync('cf', args, { stdio: ['ignore', 'ignore', 'inherit'] });
	console.log(`Created ${email} in ${target}.`);
} finally {
	prompt.close();
}
