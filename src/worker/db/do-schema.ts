import { blob, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const audioCache = sqliteTable('audio_cache', {
	id: text('id').primaryKey(),
	audio: blob('audio', { mode: 'buffer' }).notNull(),
});

export const sqliteMaster = sqliteTable('sqlite_master', {
	type: text('type'),
	name: text('name'),
});
