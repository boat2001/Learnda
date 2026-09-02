const { QueryTypes } = require('sequelize');
const { createSequelize } = require('../config/database');

const args = new Set(process.argv.slice(2));

const getArgValue = (name) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
};

const splitList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const apply = args.has('--apply');
const allExceptSuperadmin = args.has('--all-except-superadmin');
const promoteKeeper = args.has('--promote-keeper');
const emails = splitList(getArgValue('--emails'));
const phones = splitList(getArgValue('--phones'));
const ids = splitList(getArgValue('--ids'));
const keepEmail = getArgValue('--keep-email');
const keepId = getArgValue('--keep-id');
const keepEmails = [...splitList(getArgValue('--keep-emails')), keepEmail].filter(Boolean);
const keepIds = [...splitList(getArgValue('--keep-ids')), keepId].filter(Boolean);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

const sequelize = createSequelize();

async function tableExists(tableName, transaction) {
  const rows = await sequelize.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = :tableName
      LIMIT 1
    `,
    {
      replacements: { tableName },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName, transaction) {
  const rows = await sequelize.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :tableName
        AND column_name = :columnName
      LIMIT 1
    `,
    {
      replacements: { tableName, columnName },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  return rows.length > 0;
}

async function queryIfTable(tableName, sql, replacements, transaction) {
  if (!(await tableExists(tableName, transaction))) return [[], 0];
  return sequelize.query(sql, { replacements, transaction });
}

async function run() {
  if (!allExceptSuperadmin && !emails.length && !phones.length && !ids.length) {
    throw new Error(
      'Pass --all-except-superadmin, --emails=a@b.com, --phones=233..., or --ids=<uuid>. Add --apply to save changes.'
    );
  }

  await sequelize.authenticate();

  const transaction = await sequelize.transaction();
  try {
    let keeper = null;
    let keepers = [];
    if (keepIds.length || keepEmails.length) {
      const keepRows = await sequelize.query(
        `
          SELECT id, email, full_name, role, is_superadmin
          FROM users
          WHERE id::text IN (:keepIds)
             OR lower(email) IN (:keepEmails)
          ORDER BY is_superadmin DESC, created_at ASC
        `,
        {
          replacements: {
            keepIds: keepIds.length ? keepIds : ['__no_keep_id__'],
            keepEmails: keepEmails.length ? keepEmails.map(normalizeEmail) : ['__no_keep_email__'],
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      keepers = keepRows;
      keeper = keepRows.find((row) => row.is_superadmin) || keepRows[0] || null;
    }

    if (!keeper) {
      const keepRows = await sequelize.query(
        `
          SELECT id, email, full_name, role, is_superadmin
          FROM users
          WHERE is_superadmin = true
          ORDER BY created_at ASC
          LIMIT 1
        `,
        { type: QueryTypes.SELECT, transaction }
      );
      keeper = keepRows[0] || null;
    }

    if (allExceptSuperadmin && !keeper) {
      throw new Error('No superadmin user found. Pass --keep-id=<uuid> or --keep-email=<email>.');
    }

    await sequelize.query(
      `
        CREATE TEMP TABLE users_to_retire (
          id UUID PRIMARY KEY
        ) ON COMMIT DROP
      `,
      { transaction }
    );

    await sequelize.query(
      `
        CREATE TEMP TABLE users_to_keep (
          id UUID PRIMARY KEY
        ) ON COMMIT DROP
      `,
      { transaction }
    );

    if (keepers.length) {
      await sequelize.query(
        `
          INSERT INTO users_to_keep (id)
          SELECT id
          FROM users
          WHERE id::text IN (:keeperIds)
          ON CONFLICT DO NOTHING
        `,
        {
          replacements: { keeperIds: keepers.map((row) => String(row.id)) },
          transaction,
        }
      );
    }

    if (ids.length) {
      await sequelize.query(
        `
          INSERT INTO users_to_retire (id)
          SELECT id
          FROM users
          WHERE id::text IN (:ids)
          ON CONFLICT DO NOTHING
        `,
        { replacements: { ids }, transaction }
      );
    }

    if (emails.length) {
      await sequelize.query(
        `
          INSERT INTO users_to_retire (id)
          SELECT DISTINCT u.id
          FROM users u
          LEFT JOIN user_contacts uc
            ON uc.user_id = u.id
           AND uc.contact_type = 'email'
          WHERE lower(u.email) IN (:emails)
             OR lower(uc.normalized_value) IN (:emails)
             OR lower(uc.contact_value) IN (:emails)
          ON CONFLICT DO NOTHING
        `,
        {
          replacements: { emails: emails.map(normalizeEmail) },
          transaction,
        }
      );
    }

    if (phones.length) {
      await sequelize.query(
        `
          INSERT INTO users_to_retire (id)
          SELECT DISTINCT u.id
          FROM users u
          LEFT JOIN user_contacts uc
            ON uc.user_id = u.id
           AND uc.contact_type = 'phone'
          WHERE regexp_replace(COALESCE(u.country_code, '') || COALESCE(u.phone_number, ''), '[^0-9+]', '', 'g') IN (:phones)
             OR regexp_replace(COALESCE(uc.normalized_value, ''), '[^0-9+]', '', 'g') IN (:phones)
             OR regexp_replace(COALESCE(uc.contact_value, ''), '[^0-9+]', '', 'g') IN (:phones)
          ON CONFLICT DO NOTHING
        `,
        {
          replacements: { phones: phones.map(normalizePhone) },
          transaction,
        }
      );
    }

    if (allExceptSuperadmin) {
      await sequelize.query(
        `
          INSERT INTO users_to_retire (id)
          SELECT id
          FROM users
          WHERE id <> :keeperId
          ON CONFLICT DO NOTHING
        `,
        { replacements: { keeperId: keeper.id }, transaction }
      );
    }

    if (keeper) {
      await sequelize.query(
        'DELETE FROM users_to_retire WHERE id = :keeperId',
        { replacements: { keeperId: keeper.id }, transaction }
      );
    }

    await sequelize.query(
      'DELETE FROM users_to_retire WHERE id IN (SELECT id FROM users_to_keep)',
      { transaction }
    );

    const users = await sequelize.query(
      `
        SELECT id, email, full_name, role, is_superadmin, auth_provider, provider_user_id,
               country_code, phone_number
        FROM users
        WHERE id IN (SELECT id FROM users_to_retire)
        ORDER BY created_at ASC
      `,
      { type: QueryTypes.SELECT, transaction }
    );

    if (!users.length) {
      console.log('No matching users found. Nothing to retire.');
      await transaction.rollback();
      return;
    }

    if (users.some((user) => user.is_superadmin)) {
      throw new Error('Refusing to retire a superadmin. Use a more specific selector.');
    }

    const contactRows = [];
    const userContactsExist = await tableExists('user_contacts', transaction);
    if (userContactsExist) {
      contactRows.push(...await sequelize.query(
        `
          SELECT contact_type, contact_value, normalized_value
          FROM user_contacts
          WHERE user_id IN (SELECT id FROM users_to_retire)
        `,
        { type: QueryTypes.SELECT, transaction }
      ));
    }

    const contactValues = [
      ...emails,
      ...phones,
      ...users.map((user) => user.email),
      ...users.map((user) => `${user.country_code || ''}${user.phone_number || ''}`),
      ...contactRows.flatMap((row) => [row.contact_value, row.normalized_value]),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    if (keepers.length) {
      console.log('Keepers:');
      keepers.forEach((row) => console.log(`- ${row.email} (${row.id})`));
    } else {
      console.log('Keeper:', keeper ? `${keeper.email} (${keeper.id})` : 'none');
    }
    console.log('Users to retire:');
    users.forEach((user) => {
      console.log(`- ${user.email} | ${user.full_name || 'Unnamed'} | ${user.id}`);
    });

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to archive these users and free their contacts.');
      if (promoteKeeper && keeper) {
        console.log('The keeper will also be promoted to superadmin.');
      }
      await transaction.rollback();
      return;
    }

    if (promoteKeeper && keeper) {
      await sequelize.query(
        `
          UPDATE users
          SET role = 'admin',
              is_superadmin = true,
              admin_permissions = NULL,
              admin_title = 'Superadmin',
              account_status = 'active',
              deleted_at = NULL,
              updated_at = NOW()
          WHERE id = :keeperId
        `,
        { replacements: { keeperId: keeper.id }, transaction }
      );
    }

    const registrationSessionsExist = await tableExists('registration_sessions', transaction);
    if (registrationSessionsExist && contactValues.length) {
      const sessionRows = await sequelize.query(
        `
          SELECT id
          FROM registration_sessions
          WHERE lower(normalized_contact) IN (:contacts)
             OR lower(contact_value) IN (:contacts)
        `,
        {
          replacements: { contacts: contactValues.map((value) => value.toLowerCase()) },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const sessionIds = sessionRows.map((row) => row.id);

      if (sessionIds.length && await tableExists('payment_transactions', transaction)) {
        if (await columnExists('payment_transactions', 'registration_session_id', transaction)) {
          await sequelize.query(
            `
              UPDATE payment_transactions
              SET registration_session_id = NULL
              WHERE registration_session_id::text IN (:sessionIds)
            `,
            { replacements: { sessionIds }, transaction }
          );
        }
      }

      await queryIfTable(
        'registration_security_events',
        `
          DELETE FROM registration_security_events
          WHERE registration_session_id::text IN (:sessionIds)
        `,
        { sessionIds },
        transaction
      );

      await queryIfTable(
        'registration_otps',
        `
          DELETE FROM registration_otps
          WHERE registration_session_id::text IN (:sessionIds)
             OR lower(email) IN (:contacts)
             OR lower(COALESCE(contact_value, '')) IN (:contacts)
        `,
        { sessionIds, contacts: contactValues.map((value) => value.toLowerCase()) },
        transaction
      );

      await sequelize.query(
        `
          DELETE FROM registration_sessions
          WHERE id::text IN (:sessionIds)
             OR lower(normalized_contact) IN (:contacts)
             OR lower(contact_value) IN (:contacts)
        `,
        {
          replacements: { sessionIds, contacts: contactValues.map((value) => value.toLowerCase()) },
          transaction,
        }
      );
    } else if (contactValues.length) {
      await queryIfTable(
        'registration_otps',
        `
          DELETE FROM registration_otps
          WHERE lower(email) IN (:contacts)
             OR lower(COALESCE(contact_value, '')) IN (:contacts)
        `,
        { contacts: contactValues.map((value) => value.toLowerCase()) },
        transaction
      );
    }

    await queryIfTable(
      'auth_sessions',
      'DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users_to_retire)',
      {},
      transaction
    );
    await queryIfTable(
      'push_tokens',
      'DELETE FROM push_tokens WHERE user_id IN (SELECT id FROM users_to_retire)',
      {},
      transaction
    );

    if (userContactsExist) {
      await sequelize.query(
        `
          UPDATE user_contacts uc
          SET contact_value = CASE
                WHEN contact_type = 'email' THEN 'archived+' || uc.id::text || '@deleted.learnda.local'
                ELSE 'archived-' || uc.id::text
              END,
              normalized_value = CASE
                WHEN contact_type = 'email' THEN 'archived+' || uc.id::text || '@deleted.learnda.local'
                ELSE 'archived-' || uc.id::text
              END,
              is_primary = false,
              is_verified = false,
              verified_at = NULL,
              updated_at = NOW()
          WHERE uc.user_id IN (SELECT id FROM users_to_retire)
        `,
        { transaction }
      );
    }

    await sequelize.query(
      `
        UPDATE users u
        SET email = 'archived+' || u.id::text || '@deleted.learnda.local',
            country_code = NULL,
            phone_number = NULL,
            auth_provider = NULL,
            provider_user_id = NULL,
            primary_contact_id = NULL,
            account_status = CASE
              WHEN EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'account_status'
              ) THEN 'deleted'
              ELSE u.account_status
            END,
            deleted_at = NOW(),
            login_otp_hash = NULL,
            login_otp_challenge_token = NULL,
            login_otp_expires_at = NULL,
            login_otp_attempts = 0,
            session_token = NULL,
            updated_at = NOW()
        WHERE u.id IN (SELECT id FROM users_to_retire)
      `,
      { transaction }
    );

    await transaction.commit();
    console.log(`Retired ${users.length} user(s). Their email, phone, and Google identity can be registered again.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
