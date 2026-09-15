import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

/**
 * Enhetsträd: bataljon > kompani > pluton > grupp.
 *
 * I demon härleddes gruppen genom att parsa inloggningskoden
 * (`parseInt(code.split('-')[1])` med hårdkodade intervall 1–3 / 4–7 / 8–10).
 * Det slutar fungera så fort koderna blir slumpmässiga, så grupp är här
 * en riktig nivå i trädet.
 */
export const units = sqliteTable(
  'units',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['bataljon', 'kompani', 'pluton', 'grupp'] }).notNull(),
    // Självreferens — roten (bataljonen) har parentId = null.
    parentId: integer('parent_id').references((): AnySQLiteColumn => units.id, {
      onDelete: 'restrict',
    }),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('units_parent').on(t.parentId),
    // Två syskonenheter får inte heta lika, men "Grupp 1" får finnas i varje pluton.
    uniqueIndex('units_parent_name').on(t.parentId, t.name),
  ],
);

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** sha256 av inloggningskoden. Klartextkoden lagras aldrig. */
    codeHash: text('code_hash').notNull().unique(),
    /** Visningsnamn i admin, t.ex. "Soldat 3" eller "Plutonchef". Inte en personuppgift. */
    label: text('label').notNull(),
    role: text('role', {
      enum: ['soldat', 'pluton', 'kompani', 'bataljon', 'admin'],
    }).notNull(),
    unitId: integer('unit_id')
      .notNull()
      .references((): AnySQLiteColumn => units.id, { onDelete: 'restrict' }),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    lastLoginAt: text('last_login_at'),
  },
  (t) => [
    index('users_unit').on(t.unitId),
    index('users_role').on(t.role),
    // Aggregatfrågorna filtrerar alltid på aktiva soldater inom ett subträd.
    index('users_unit_role_active').on(t.unitId, t.role, t.active),
  ],
);

export const checkIns = sqliteTable(
  'check_ins',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id, { onDelete: 'cascade' }),
    /** 'YYYY-MM-DD' i Europe/Stockholm — se src/lib/date.ts */
    serviceDate: text('service_date').notNull(),
    fysisk: integer('fysisk').notNull(),
    psykisk: integer('psykisk').notNull(),
    social: integer('social').notNull(),
    somn: integer('somn').notNull(),
    kost: integer('kost').notNull(),
    energi: integer('energi').notNull(),
    /** Rådet som genererades vid incheckningen, sparat som det såg ut då. */
    advice: text('advice'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    // En incheckning per soldat och dag. Ny incheckning samma dag skriver över.
    uniqueIndex('check_ins_user_date').on(t.userId, t.serviceDate),
    index('check_ins_date').on(t.serviceDate),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** sha256 av sessionstoken. Cookien bär den råa token, databasen bara hashen. */
    tokenHash: text('token_hash').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(), // epoch ms
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('sessions_user').on(t.userId)],
);

/**
 * Notiser till befäl.
 *
 * Medvetet på *enhetsnivå*, aldrig individnivå: en notis säger
 * "2 soldater i Grupp 2 har röda värden", inte vem. Det följer samma
 * princip som befälsvyerna i övrigt. Om Försvarsmakten senare beslutar
 * att någon roll ska kunna se individer är det ett policybeslut som
 * kräver egen behandling — inte något som ska smyga in via notiser.
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipientUserId: integer('recipient_user_id')
      .notNull()
      .references((): AnySQLiteColumn => users.id, { onDelete: 'cascade' }),
    subjectUnitId: integer('subject_unit_id')
      .notNull()
      .references((): AnySQLiteColumn => units.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['red_values', 'low_response'] }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    serviceDate: text('service_date').notNull(),
    readAt: text('read_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('notifications_recipient').on(t.recipientUserId, t.readAt),
    // En notis per mottagare, enhet, typ och dag — hindrar dubbletter.
    uniqueIndex('notifications_unique_per_day').on(
      t.recipientUserId,
      t.subjectUnitId,
      t.kind,
      t.serviceDate,
    ),
  ],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    actorUserId: integer('actor_user_id').references((): AnySQLiteColumn => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    detail: text('detail'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('audit_created').on(t.createdAt)],
);

/** Spärr mot att gissa inloggningskoder. Rensas periodiskt. */
export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ip: text('ip').notNull(),
    succeeded: integer('succeeded', { mode: 'boolean' }).notNull(),
    attemptedAt: integer('attempted_at').notNull(), // epoch ms
  },
  (t) => [index('login_attempts_ip_time').on(t.ip, t.attemptedAt)],
);
