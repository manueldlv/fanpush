#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const MODE = (process.argv[2] ?? "reseed").toLowerCase();
const SEED_TAG = "fanpush-dummy-seed-v1";
const SEED_PAYMENT_PREFIX = "seed-dummy-payment";
const PUBLIC_BUCKET = "Imagenes";
const PREMIUM_BUCKET = "premium";
const SHARED_PASSWORD = "FanpushDemo123!";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date();

const USERS = {
  admin: {
    key: "admin",
    email: "seed-admin@fanpush.test",
    password: SHARED_PASSWORD,
    username: "seed_admin",
    fullName: "Seed Admin",
    country: "Argentina",
    locale: "es-AR",
    bio: "Cuenta administrativa dummy para probar el inbox y el panel.",
    website: "https://fanpush.test/admin-demo",
    instagram: "seed_admin",
    badgeState: {
      isBlocked: false,
      blockedReason: null,
      kycLevel: "staff",
      badges: ["staff", "seed"],
      isVerified: true,
      isFeatured: false,
    },
    avatarUrl: "https://picsum.photos/seed/fanpush-seed-admin-avatar/512/512",
  },
  author: {
    key: "author",
    email: "seed-author@fanpush.test",
    password: SHARED_PASSWORD,
    username: "seed_author",
    fullName: "Seed Author",
    country: "Argentina",
    locale: "es-AR",
    bio: "Autor dummy con contenido gratis y premium para probar compras, likes y retiros.",
    website: "https://fanpush.test/author-demo",
    instagram: "seed_author",
    badgeState: {
      isBlocked: false,
      blockedReason: null,
      kycLevel: "verified",
      badges: ["author", "seed", "featured"],
      isVerified: true,
      isFeatured: true,
    },
    avatarUrl: "https://picsum.photos/seed/fanpush-seed-author-avatar/512/512",
    payoutProfile: {
      alias: "seed.author.demo",
      holderName: "Seed Author",
      holderDocument: "30111222",
      notes: "Cuenta dummy para pruebas manuales.",
    },
    commission: {
      creatorShare: 0.8,
      platformShare: 0.2,
    },
  },
  buyer: {
    key: "buyer",
    email: "seed-buyer@fanpush.test",
    password: SHARED_PASSWORD,
    username: "seed_buyer",
    fullName: "Seed Buyer",
    country: "Argentina",
    locale: "es-AR",
    bio: "Comprador dummy para probar follows, likes, compras y mensajes.",
    website: "https://fanpush.test/buyer-demo",
    instagram: "seed_buyer",
    badgeState: {
      isBlocked: false,
      blockedReason: null,
      kycLevel: "basic",
      badges: ["seed"],
      isVerified: false,
      isFeatured: false,
    },
    avatarUrl: "https://picsum.photos/seed/fanpush-seed-buyer-avatar/512/512",
  },
};

const SAMPLE_IMAGES = {
  docFront: "https://picsum.photos/seed/fanpush-seed-doc-front/1200/800",
  docBack: "https://picsum.photos/seed/fanpush-seed-doc-back/1200/800",
  freePost: "https://picsum.photos/seed/fanpush-seed-free-post/1400/1800",
  premiumPostA: "https://picsum.photos/seed/fanpush-seed-premium-a/1400/1800",
  premiumPostB: "https://picsum.photos/seed/fanpush-seed-premium-b/1400/1800",
  moderatedPost: "https://picsum.photos/seed/fanpush-seed-moderated/1400/1800",
};

const log = (message) => {
  process.stdout.write(`${message}\n`);
};

const exitWithError = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const readEnvFiles = () => {
  const candidates = [
    path.join(REPO_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      if (!key || process.env[key]) continue;

      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
};

readEnvFiles();

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  exitWithError(
    "Faltan SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY.",
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const notificationPreferencesTemplate = (updatedAt) => ({
  updatedAt,
  push: {
    follow: true,
    tip: true,
    purchase: true,
    withdrawal_update: true,
    author_application_update: true,
    content_removed_update: true,
  },
  email: {
    follow: true,
    tip: true,
    purchase: true,
    withdrawal_update: true,
    author_application_update: true,
    content_removed_update: true,
  },
});

const isoAt = (msDelta) => new Date(NOW.getTime() + msDelta).toISOString();
const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const currentMonthKey = (date = NOW) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const threadPreview = (body) => body.trim().replace(/\s+/g, " ").slice(0, 180);

const throwIfError = (error, fallback) => {
  if (error) {
    throw new Error(`${fallback}: ${error.message}`);
  }
};

const serializeProfileDetails = (value) =>
  JSON.stringify({
    bio: value.bio.trim(),
    website: value.website.trim(),
    instagram: value.instagram.trim(),
    updatedAt: value.updatedAt,
  });

const serializePayoutProfile = (profile) =>
  `payout_profile:${JSON.stringify({
    alias: profile.alias,
    holderName: profile.holderName,
    holderDocument: profile.holderDocument,
    notes: profile.notes ?? "",
    updatedAt: profile.updatedAt,
  })}`;

const serializeNotificationPreferences = (preferences) => JSON.stringify(preferences);

const serializeAuthorApplication = (record) =>
  `author_application:${JSON.stringify(record)}`;

const serializeAuthorApplicationHistory = (record) =>
  `author_application_history:${JSON.stringify(record)}`;

const serializeUserCommissionProfile = (record) =>
  `user_commission_profile:${JSON.stringify(record)}`;

const serializeWithdrawalRecord = (record) =>
  `withdrawal_request:${JSON.stringify(record)}`;

const serializeWithdrawalHistory = (record) =>
  `withdrawal_history:${JSON.stringify(record)}`;

const serializeContentReport = (record) =>
  `content_report:${JSON.stringify(record)}`;

const serializeModerationAction = (record) =>
  `moderation_action:${JSON.stringify(record)}`;

const serializeModerationArchive = (record) =>
  `moderation_archive:${JSON.stringify(record)}`;

const serializeModerationContentState = (record) =>
  `moderation_content_state:${JSON.stringify(record)}`;

const buildLockedPreviewPath = (userId, token) =>
  `locked-previews/${userId}/${token}__image__jpg.jpg`;

const buildPremiumPath = (userId, token) => `premium/${userId}/${token}.jpg`;

const buildSeedPublicPath = (userId, token) => `seed-dummy/posts/${userId}/${token}.jpg`;

const buildSeedAvatarPath = (userId) => `seed-dummy/avatars/${userId}/avatar.jpg`;
const buildSeedDocumentPath = (userId, fileName) =>
  `seed-dummy/documents/${userId}/${fileName}.jpg`;

const publicUrlFor = (bucket, storagePath) =>
  admin.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

const ensureBucket = async (bucketName, isPublic) => {
  const { data: buckets, error } = await admin.storage.listBuckets();
  throwIfError(error, "No se pudieron leer los buckets");

  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName);
  if (exists) return;

  const { error: createError } = await admin.storage.createBucket(bucketName, {
    public: isPublic,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`No se pudo crear el bucket ${bucketName}: ${createError.message}`);
  }
};

const ensureBuckets = async () => {
  await ensureBucket(PUBLIC_BUCKET, true);
  await ensureBucket(PREMIUM_BUCKET, false);
};

const fetchBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

const uploadBuffer = async ({
  bucket,
  storagePath,
  buffer,
  contentType = "image/jpeg",
}) => {
  const { error } = await admin.storage.from(bucket).upload(storagePath, buffer, {
    upsert: true,
    contentType,
  });
  throwIfError(error, `No se pudo subir ${storagePath}`);
};

const uploadRemoteImage = async ({ bucket, storagePath, sourceUrl }) => {
  const buffer = await fetchBuffer(sourceUrl);
  await uploadBuffer({
    bucket,
    storagePath,
    buffer,
    contentType: "image/jpeg",
  });
  return storagePath;
};

const applyBalanceDelta = async ({
  userId,
  cashAvailable = 0,
  cashPending = 0,
  cashReserved = 0,
  bonusAvailable = 0,
  lifetimeDeposited = 0,
  lifetimeSpent = 0,
  lifetimeEarned = 0,
  lifetimeWithdrawn = 0,
}) => {
  const { error } = await admin.rpc("apply_user_balance_delta", {
    target_user_id: userId,
    cash_available_delta: roundMoney(cashAvailable),
    cash_pending_delta: roundMoney(cashPending),
    cash_reserved_delta: roundMoney(cashReserved),
    bonus_available_delta: roundMoney(bonusAvailable),
    lifetime_deposited_delta: roundMoney(lifetimeDeposited),
    lifetime_spent_delta: roundMoney(lifetimeSpent),
    lifetime_earned_delta: roundMoney(lifetimeEarned),
    lifetime_withdrawn_delta: roundMoney(lifetimeWithdrawn),
  });
  throwIfError(error, "No se pudo actualizar el balance");
};

const listSeedPublicUsers = async () => {
  const usernames = Object.values(USERS).map((user) => user.username);
  const { data, error } = await admin
    .from("users")
    .select("id,username")
    .in("username", usernames);
  throwIfError(error, "No se pudieron leer los usuarios dummy");
  return data ?? [];
};

const removeIfExists = async (bucket, storagePath) => {
  const { error } = await admin.storage.from(bucket).remove([storagePath]);
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`No se pudo borrar ${storagePath}: ${error.message}`);
  }
};

const deleteAuthUser = async (userId) => {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !/user not found/i.test(error.message)) {
    throw new Error(`No se pudo borrar auth.users(${userId}): ${error.message}`);
  }
};

const createAuthUser = async (user) => {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      username: user.username,
      full_name: user.fullName,
    },
  });

  throwIfError(error, `No se pudo crear la cuenta ${user.email}`);

  if (!data?.user?.id) {
    throw new Error(`No se recibio el usuario creado para ${user.email}.`);
  }

  return data.user;
};

const syncPublicRows = async ({ authUser, userConfig, avatarPath }) => {
  const nowIso = NOW.toISOString();
  const { error: userError } = await admin.from("users").upsert(
    {
      id: authUser.id,
      username: userConfig.username,
      avatar_url: avatarPath,
      bio: userConfig.bio,
      website: userConfig.website,
      instagram: userConfig.instagram,
      updated_at: nowIso,
    },
    { onConflict: "id" },
  );
  throwIfError(userError, `No se pudo sincronizar users(${userConfig.username})`);

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: authUser.id,
      full_name: userConfig.fullName,
      email: userConfig.email,
      country: userConfig.country,
      locale: userConfig.locale,
      updated_at: nowIso,
    },
    { onConflict: "id" },
  );
  throwIfError(profileError, `No se pudo sincronizar profiles(${userConfig.username})`);

  const { error: balanceError } = await admin
    .from("user_balances")
    .upsert({ user_id: authUser.id }, { onConflict: "user_id" });
  throwIfError(balanceError, `No se pudo crear user_balances(${userConfig.username})`);
};

const createUserMetaRows = async ({ userId, userConfig, payoutProfile }) => {
  const updatedAt = NOW.toISOString();
  const profileDetails = {
    bio: userConfig.bio,
    website: userConfig.website,
    instagram: userConfig.instagram,
    updatedAt,
  };
  const preferences = notificationPreferencesTemplate(updatedAt);
  const accountState = {
    ...userConfig.badgeState,
    updatedAt,
  };

  const metaRows = [
    {
      user_id: userId,
      meta_key: "profile.details",
      meta_value: profileDetails,
      updated_at: updatedAt,
    },
    {
      user_id: userId,
      meta_key: "notification.preferences",
      meta_value: preferences,
      updated_at: updatedAt,
    },
    {
      user_id: userId,
      meta_key: "account.state",
      meta_value: accountState,
      updated_at: updatedAt,
    },
  ];

  if (payoutProfile) {
    metaRows.push({
      user_id: userId,
      meta_key: "payout.profile",
      meta_value: payoutProfile,
      updated_at: updatedAt,
    });
  }

  const { error } = await admin
    .from("user_meta")
    .upsert(metaRows, { onConflict: "user_id,meta_key" });
  throwIfError(error, "No se pudo guardar user_meta");

  return { updatedAt, profileDetails, preferences, accountState };
};

const createLegacyMetaNotifications = async ({
  userId,
  profileDetails,
  preferences,
  payoutProfile,
  createdAt,
}) => {
  const rows = [
    {
      user_id: userId,
      actor_id: userId,
      entity_id: userId,
      type: "profile_meta",
      message: serializeProfileDetails(profileDetails),
      is_read: true,
      created_at: createdAt,
    },
    {
      user_id: userId,
      actor_id: userId,
      entity_id: userId,
      type: "notification_preferences",
      message: serializeNotificationPreferences(preferences),
      is_read: true,
      created_at: createdAt,
    },
  ];

  if (payoutProfile) {
    rows.push({
      user_id: userId,
      actor_id: userId,
      entity_id: userId,
      type: "payout_profile",
      message: serializePayoutProfile(payoutProfile),
      is_read: true,
      created_at: createdAt,
    });
  }

  const { error } = await admin.from("notifications").insert(rows);
  throwIfError(error, "No se pudieron guardar las notificaciones meta");
};

const getRoleIdMap = async () => {
  const { data, error } = await admin
    .from("roles")
    .select("id,code")
    .in("code", ["admin", "author"]);
  throwIfError(error, "No se pudieron leer los roles");
  return new Map((data ?? []).map((row) => [row.code, row.id]));
};

const assignRole = async ({ userId, roleId, grantedBy }) => {
  const { error } = await admin.from("user_roles").insert({
    user_id: userId,
    role_id: roleId,
    granted_by: grantedBy,
  });

  if (error && !/duplicate key/i.test(error.message)) {
    throw new Error(`No se pudo asignar el rol: ${error.message}`);
  }
};

const createCommissionProfile = async ({
  userId,
  adminUserId,
  creatorShare,
  platformShare,
  createdAt,
}) => {
  const { error: tableError } = await admin.from("user_commission_profiles").insert({
    user_id: userId,
    creator_share_rate: creatorShare,
    platform_share_rate: platformShare,
    reason: "Dummy seed para pruebas manuales.",
    updated_by: adminUserId,
    created_at: createdAt,
  });
  throwIfError(tableError, "No se pudo guardar user_commission_profiles");

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: userId,
    actor_id: adminUserId,
    entity_id: userId,
    type: "user_commission_profile",
    message: serializeUserCommissionProfile({
      creatorShare,
      platformShare,
      updatedAt: createdAt,
    }),
    is_read: true,
    created_at: createdAt,
  });
  throwIfError(notificationError, "No se pudo guardar la notificacion de comision");
};

const createAlbumWithPosts = async ({
  ownerUserId,
  description,
  price,
  visibility = "published",
  createdAt,
  mediaItems,
}) => {
  const { data: album, error: albumError } = await admin
    .from("albums")
    .insert({
      user_id: ownerUserId,
      description,
      price,
      visibility,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select("id,user_id,description,price,created_at")
    .single();
  throwIfError(albumError, "No se pudo crear el album");

  const { data: posts, error: postsError } = await admin
    .from("posts")
    .insert(
      mediaItems.map((item) => ({
        user_id: ownerUserId,
        media_url: item.mediaUrl,
        media_type: item.mediaType,
        is_locked: item.isLocked,
        likes_count: item.likesCount ?? 0,
        caption: item.caption,
        created_at: createdAt,
        updated_at: createdAt,
      })),
    )
    .select("id,user_id,media_url,media_type,is_locked,likes_count,caption,created_at");
  throwIfError(postsError, "No se pudieron crear los posts");

  const links = (posts ?? []).map((post, index) => ({
    album_id: album.id,
    post_id: post.id,
    position: index,
    created_at: createdAt,
  }));

  const { error: linksError } = await admin.from("album_posts").insert(links);
  throwIfError(linksError, "No se pudieron vincular los posts al album");

  return {
    album,
    posts: posts ?? [],
  };
};

const markLike = async ({ userId, postId, createdAt }) => {
  const { error: likeError } = await admin.from("likes").insert({
    user_id: userId,
    post_id: postId,
    created_at: createdAt,
  });
  throwIfError(likeError, "No se pudo crear el like");

  const { error: updateError } = await admin
    .from("posts")
    .update({ likes_count: 1, updated_at: createdAt })
    .eq("id", postId);
  throwIfError(updateError, "No se pudo actualizar likes_count");
};

const createFollow = async ({ followerId, followingId, createdAt }) => {
  const { error } = await admin.from("follows").insert({
    follower_id: followerId,
    following_id: followingId,
    created_at: createdAt,
  });
  throwIfError(error, "No se pudo crear el follow");
};

const createNotification = async (row) => {
  const { error } = await admin.from("notifications").insert(row);
  throwIfError(error, `No se pudo crear la notificacion ${row.type}`);
};

const createNotificationThread = async ({
  userId,
  topic,
  subject,
  sourceType = null,
  sourceId = null,
  allowUserReply = true,
  createdBy = null,
  messages,
  status = "open",
}) => {
  if (!messages.length) {
    throw new Error("Cada hilo dummy necesita al menos un mensaje.");
  }

  const sortedMessages = [...messages].sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt)),
  );
  const lastMessage = sortedMessages[sortedMessages.length - 1];
  const lastAdminMessage = [...sortedMessages]
    .reverse()
    .find((message) => message.senderRole === "admin");

  const threadId = crypto.randomUUID();

  const { error: threadError } = await admin.from("notification_threads").insert({
    id: threadId,
    user_id: userId,
    topic,
    subject,
    status,
    source_type: sourceType,
    source_id: sourceId,
    allow_user_reply: allowUserReply,
    created_by: createdBy,
    last_admin_user_id: lastAdminMessage?.senderId ?? createdBy,
    last_message_preview: threadPreview(lastMessage.body),
    last_sender_role: lastMessage.senderRole,
    last_message_at: lastMessage.createdAt,
    user_last_read_at:
      sortedMessages
        .filter((message) => message.senderRole === "user")
        .slice(-1)[0]?.createdAt ?? null,
    admin_last_read_at: lastAdminMessage?.createdAt ?? null,
    created_at: sortedMessages[0].createdAt,
    updated_at: lastMessage.createdAt,
  });
  throwIfError(threadError, "No se pudo crear notification_threads");

  const { error: messagesError } = await admin.from("notification_messages").insert(
    sortedMessages.map((message) => ({
      id: crypto.randomUUID(),
      thread_id: threadId,
      sender_id: message.senderId ?? null,
      sender_role: message.senderRole,
      body: message.body.trim(),
      metadata: {
        seed: SEED_TAG,
      },
      created_at: message.createdAt,
    })),
  );
  throwIfError(messagesError, "No se pudieron crear notification_messages");

  return threadId;
};

const createDepositForBuyer = async ({ buyerUserId, amount, createdAt }) => {
  const transactionId = crypto.randomUUID();
  const providerReference = `${SEED_PAYMENT_PREFIX}-deposit-buyer`;

  const { error: transactionError } = await admin.from("ledger_transactions").insert({
    id: transactionId,
    kind: "deposit",
    status: "approved",
    currency: "ARS",
    transaction_amount: roundMoney(amount),
    creator_amount: 0,
    platform_fee_amount: 0,
    buyer_user_id: buyerUserId,
    recipient_user_id: buyerUserId,
    source_type: "user_balance",
    source_id: buyerUserId,
    external_provider: "mercadopago",
    external_reference: providerReference,
    provider_payment_id: providerReference,
    metadata: {
      seed: SEED_TAG,
      channel: "manual_seed",
    },
    created_at: createdAt,
    updated_at: createdAt,
  });
  throwIfError(transactionError, "No se pudo crear la transaccion de deposito");

  const { error: entriesError } = await admin.from("ledger_entries").insert([
    {
      transaction_id: transactionId,
      user_id: buyerUserId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "credit",
      amount: roundMoney(amount),
      metadata: { seed: SEED_TAG, stage: "deposit" },
      created_at: createdAt,
    },
    {
      transaction_id: transactionId,
      entry_scope: "provider",
      account_code: "provider.mercadopago_clearing",
      direction: "credit",
      amount: roundMoney(amount),
      metadata: { seed: SEED_TAG, stage: "deposit" },
      created_at: createdAt,
    },
  ]);
  throwIfError(entriesError, "No se pudieron crear los asientos del deposito");

  const { error: movementError } = await admin.from("provider_movements").insert({
    provider: "mercadopago",
    movement_kind: "deposit_in",
    status: "approved",
    currency: "ARS",
    amount: roundMoney(amount),
    external_reference: providerReference,
    user_id: buyerUserId,
    ledger_transaction_id: transactionId,
    payload: {
      seed: SEED_TAG,
    },
    occurred_at: createdAt,
    created_at: createdAt,
  });
  throwIfError(movementError, "No se pudo crear provider_movements");

  await applyBalanceDelta({
    userId: buyerUserId,
    cashAvailable: amount,
    lifetimeDeposited: amount,
  });

  return transactionId;
};

const createInternalDonation = async ({
  buyerUserId,
  recipientUserId,
  amount,
  creatorShare,
  createdAt,
}) => {
  const transactionId = crypto.randomUUID();
  const creatorAmount = roundMoney(amount * creatorShare);
  const platformFeeAmount = roundMoney(amount - creatorAmount);

  const { error: transactionError } = await admin.from("ledger_transactions").insert({
    id: transactionId,
    kind: "donation",
    status: "approved",
    currency: "ARS",
    transaction_amount: roundMoney(amount),
    creator_share_rate: creatorShare,
    platform_share_rate: roundMoney(1 - creatorShare),
    creator_amount: creatorAmount,
    platform_fee_amount: platformFeeAmount,
    buyer_user_id: buyerUserId,
    recipient_user_id: recipientUserId,
    source_type: "user",
    source_id: recipientUserId,
    metadata: {
      seed: SEED_TAG,
      channel: "manual_internal_seed",
      note: "Donacion dummy sin UI dedicada todavia.",
    },
    created_at: createdAt,
    updated_at: createdAt,
  });
  throwIfError(transactionError, "No se pudo crear la transaccion donation");

  const entries = [
    {
      transaction_id: transactionId,
      user_id: buyerUserId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "debit",
      amount: roundMoney(amount),
      metadata: { seed: SEED_TAG, stage: "donation" },
      created_at: createdAt,
    },
    {
      transaction_id: transactionId,
      user_id: recipientUserId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "credit",
      amount: creatorAmount,
      metadata: { seed: SEED_TAG, stage: "donation" },
      created_at: createdAt,
    },
  ];

  if (platformFeeAmount > 0) {
    entries.push({
      transaction_id: transactionId,
      entry_scope: "platform",
      account_code: "platform.fee_revenue",
      direction: "credit",
      amount: platformFeeAmount,
      metadata: { seed: SEED_TAG, stage: "donation" },
      created_at: createdAt,
    });
  }

  const { error: entriesError } = await admin.from("ledger_entries").insert(entries);
  throwIfError(entriesError, "No se pudieron crear los asientos de donation");

  await applyBalanceDelta({
    userId: buyerUserId,
    cashAvailable: -amount,
    lifetimeSpent: amount,
  });

  await applyBalanceDelta({
    userId: recipientUserId,
    cashAvailable: creatorAmount,
    lifetimeEarned: creatorAmount,
  });

  return transactionId;
};

const createWithdrawalRequest = async ({
  authorUserId,
  amount,
  requestedAt,
}) => {
  const withdrawalId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const monthKey = currentMonthKey(new Date(requestedAt));

  const { error: txError } = await admin.from("ledger_transactions").insert({
    id: transactionId,
    kind: "payout_request",
    status: "reserved",
    currency: "ARS",
    transaction_amount: roundMoney(amount),
    creator_amount: 0,
    platform_fee_amount: 0,
    recipient_user_id: authorUserId,
    source_type: "withdrawal_request",
    source_id: withdrawalId,
    metadata: {
      seed: SEED_TAG,
      monthKey,
    },
    created_at: requestedAt,
    updated_at: requestedAt,
  });
  throwIfError(txError, "No se pudo crear ledger_transactions para el retiro");

  const { error: entriesError } = await admin.from("ledger_entries").insert([
    {
      transaction_id: transactionId,
      user_id: authorUserId,
      entry_scope: "user",
      account_code: "user.cash_available",
      balance_bucket: "cash_available",
      direction: "debit",
      amount: roundMoney(amount),
      metadata: { seed: SEED_TAG, stage: "withdrawal_request" },
      created_at: requestedAt,
    },
    {
      transaction_id: transactionId,
      user_id: authorUserId,
      entry_scope: "user",
      account_code: "user.cash_reserved",
      balance_bucket: "cash_reserved",
      direction: "credit",
      amount: roundMoney(amount),
      metadata: { seed: SEED_TAG, stage: "withdrawal_request" },
      created_at: requestedAt,
    },
  ]);
  throwIfError(entriesError, "No se pudieron crear los asientos del retiro");

  await applyBalanceDelta({
    userId: authorUserId,
    cashAvailable: -amount,
    cashReserved: amount,
  });

  const { error: requestError } = await admin.from("withdrawal_requests").insert({
    id: withdrawalId,
    user_id: authorUserId,
    amount: roundMoney(amount),
    status: "requested",
    ledger_transaction_id: transactionId,
    month_key: monthKey,
    requested_at: requestedAt,
    created_at: requestedAt,
    updated_at: requestedAt,
    metadata: {
      seed: SEED_TAG,
    },
  });
  throwIfError(requestError, "No se pudo crear withdrawal_requests");

  return { withdrawalId, transactionId, monthKey };
};

const createSeedData = async ({ cleanFirst = true } = {}) => {
  log("Preparando buckets para el seed dummy...");
  await ensureBuckets();

  if (cleanFirst) {
    log("Limpiando cualquier seed previo...");
    await cleanSeedData();
  }

  log("Creando cuentas auth dummy...");
  const adminAuthUser = await createAuthUser(USERS.admin);
  const authorAuthUser = await createAuthUser(USERS.author);
  const buyerAuthUser = await createAuthUser(USERS.buyer);

  log("Subiendo avatars y documentos dummy...");
  const adminAvatarPath = buildSeedAvatarPath(adminAuthUser.id);
  const authorAvatarPath = buildSeedAvatarPath(authorAuthUser.id);
  const buyerAvatarPath = buildSeedAvatarPath(buyerAuthUser.id);
  const authorDocFrontPath = buildSeedDocumentPath(authorAuthUser.id, "front");
  const authorDocBackPath = buildSeedDocumentPath(authorAuthUser.id, "back");

  await Promise.all([
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: adminAvatarPath,
      sourceUrl: USERS.admin.avatarUrl,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: authorAvatarPath,
      sourceUrl: USERS.author.avatarUrl,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: buyerAvatarPath,
      sourceUrl: USERS.buyer.avatarUrl,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: authorDocFrontPath,
      sourceUrl: SAMPLE_IMAGES.docFront,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: authorDocBackPath,
      sourceUrl: SAMPLE_IMAGES.docBack,
    }),
  ]);

  log("Sincronizando filas publicas y metadata base...");
  await syncPublicRows({
    authUser: adminAuthUser,
    userConfig: USERS.admin,
    avatarPath: adminAvatarPath,
  });
  await syncPublicRows({
    authUser: authorAuthUser,
    userConfig: USERS.author,
    avatarPath: authorAvatarPath,
  });
  await syncPublicRows({
    authUser: buyerAuthUser,
    userConfig: USERS.buyer,
    avatarPath: buyerAvatarPath,
  });

  const adminMeta = await createUserMetaRows({
    userId: adminAuthUser.id,
    userConfig: USERS.admin,
    payoutProfile: null,
  });
  const authorMeta = await createUserMetaRows({
    userId: authorAuthUser.id,
    userConfig: USERS.author,
    payoutProfile: {
      ...USERS.author.payoutProfile,
      updatedAt: isoAt(-5 * DAY_MS),
    },
  });
  const buyerMeta = await createUserMetaRows({
    userId: buyerAuthUser.id,
    userConfig: USERS.buyer,
    payoutProfile: null,
  });

  await createLegacyMetaNotifications({
    userId: adminAuthUser.id,
    profileDetails: adminMeta.profileDetails,
    preferences: adminMeta.preferences,
    payoutProfile: null,
    createdAt: isoAt(-8 * DAY_MS),
  });
  await createLegacyMetaNotifications({
    userId: authorAuthUser.id,
    profileDetails: authorMeta.profileDetails,
    preferences: authorMeta.preferences,
    payoutProfile: {
      ...USERS.author.payoutProfile,
      updatedAt: isoAt(-5 * DAY_MS),
    },
    createdAt: isoAt(-8 * DAY_MS),
  });
  await createLegacyMetaNotifications({
    userId: buyerAuthUser.id,
    profileDetails: buyerMeta.profileDetails,
    preferences: buyerMeta.preferences,
    payoutProfile: null,
    createdAt: isoAt(-8 * DAY_MS),
  });

  log("Asignando roles y comision del autor...");
  const roleMap = await getRoleIdMap();
  const adminRoleId = roleMap.get("admin");
  const authorRoleId = roleMap.get("author");
  if (!adminRoleId || !authorRoleId) {
    throw new Error("No se encontraron los roles admin/author en la base.");
  }

  await assignRole({
    userId: adminAuthUser.id,
    roleId: adminRoleId,
    grantedBy: adminAuthUser.id,
  });
  await assignRole({
    userId: authorAuthUser.id,
    roleId: authorRoleId,
    grantedBy: adminAuthUser.id,
  });

  await createCommissionProfile({
    userId: authorAuthUser.id,
    adminUserId: adminAuthUser.id,
    creatorShare: USERS.author.commission.creatorShare,
    platformShare: USERS.author.commission.platformShare,
    createdAt: isoAt(-6 * DAY_MS),
  });

  log("Creando albums y posts dummy...");
  const freePostPath = buildSeedPublicPath(authorAuthUser.id, "free-look-1");
  const moderatedPostPath = buildSeedPublicPath(authorAuthUser.id, "moderated-look-1");
  const premiumPreviewPathA = buildLockedPreviewPath(authorAuthUser.id, "seed-premium-a");
  const premiumPreviewPathB = buildLockedPreviewPath(authorAuthUser.id, "seed-premium-b");
  const premiumPathA = buildPremiumPath(authorAuthUser.id, "seed-premium-a");
  const premiumPathB = buildPremiumPath(authorAuthUser.id, "seed-premium-b");

  await Promise.all([
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: freePostPath,
      sourceUrl: SAMPLE_IMAGES.freePost,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: moderatedPostPath,
      sourceUrl: SAMPLE_IMAGES.moderatedPost,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: premiumPreviewPathA,
      sourceUrl: SAMPLE_IMAGES.premiumPostA,
    }),
    uploadRemoteImage({
      bucket: PUBLIC_BUCKET,
      storagePath: premiumPreviewPathB,
      sourceUrl: SAMPLE_IMAGES.premiumPostB,
    }),
    uploadRemoteImage({
      bucket: PREMIUM_BUCKET,
      storagePath: premiumPathA,
      sourceUrl: SAMPLE_IMAGES.premiumPostA,
    }),
    uploadRemoteImage({
      bucket: PREMIUM_BUCKET,
      storagePath: premiumPathB,
      sourceUrl: SAMPLE_IMAGES.premiumPostB,
    }),
  ]);

  const freeAlbumBundle = await createAlbumWithPosts({
    ownerUserId: authorAuthUser.id,
    description: "Album gratis dummy para probar feed, likes y follows.",
    price: 0,
    createdAt: isoAt(-4 * DAY_MS),
    mediaItems: [
      {
        mediaUrl: freePostPath,
        mediaType: "image",
        isLocked: false,
        caption: "Preview publica para el feed dummy.",
      },
    ],
  });

  const premiumAlbumBundle = await createAlbumWithPosts({
    ownerUserId: authorAuthUser.id,
    description: "Album premium dummy para probar compra y acceso.",
    price: 90000,
    createdAt: isoAt(-3 * DAY_MS),
    mediaItems: [
      {
        mediaUrl: premiumPreviewPathA,
        mediaType: "image",
        isLocked: true,
        caption: "Set premium dummy 1.",
      },
      {
        mediaUrl: premiumPreviewPathB,
        mediaType: "image",
        isLocked: true,
        caption: "Set premium dummy 2.",
      },
    ],
  });

  const moderatedAlbumBundle = await createAlbumWithPosts({
    ownerUserId: authorAuthUser.id,
    description: "Album moderado dummy para probar reportes y archive.",
    price: 0,
    createdAt: isoAt(-2 * DAY_MS),
    mediaItems: [
      {
        mediaUrl: moderatedPostPath,
        mediaType: "image",
        isLocked: false,
        caption: "Contenido reportado y luego removido.",
      },
    ],
  });

  log("Creando interacciones sociales...");
  await createFollow({
    followerId: buyerAuthUser.id,
    followingId: authorAuthUser.id,
    createdAt: isoAt(-36 * HOUR_MS),
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: buyerAuthUser.id,
    entity_id: buyerAuthUser.id,
    type: "follow",
    message: "comenzó a seguirte.",
    is_read: false,
    created_at: isoAt(-36 * HOUR_MS),
  });

  await markLike({
    userId: buyerAuthUser.id,
    postId: freeAlbumBundle.posts[0].id,
    createdAt: isoAt(-30 * HOUR_MS),
  });

  log("Acreditando saldo al comprador y ejecutando compra/propina...");
  await createDepositForBuyer({
    buyerUserId: buyerAuthUser.id,
    amount: 200000,
    createdAt: isoAt(-28 * HOUR_MS),
  });

  const { data: purchaseData, error: purchaseError } = await admin.rpc(
    "process_internal_album_purchase",
    {
      p_buyer_user_id: buyerAuthUser.id,
      p_album_id: premiumAlbumBundle.album.id,
    },
  );
  throwIfError(purchaseError, "No se pudo ejecutar la compra interna dummy");
  const purchaseTransactionId = Array.isArray(purchaseData)
    ? purchaseData[0]?.transaction_id
    : purchaseData?.transaction_id;

  const { data: tipData, error: tipError } = await admin.rpc("process_internal_tip_payment", {
    p_buyer_user_id: buyerAuthUser.id,
    p_recipient_user_id: authorAuthUser.id,
    p_amount: 20000,
  });
  throwIfError(tipError, "No se pudo ejecutar la propina interna dummy");
  const tipTransactionId = Array.isArray(tipData)
    ? tipData[0]?.transaction_id
    : tipData?.transaction_id;

  await createInternalDonation({
    buyerUserId: buyerAuthUser.id,
    recipientUserId: authorAuthUser.id,
    amount: 100,
    creatorShare: USERS.author.commission.creatorShare,
    createdAt: isoAt(-20 * HOUR_MS),
  });

  log("Creando solicitud de autor aprobada y su hilo...");
  const authorApplicationId = crypto.randomUUID();
  const authorApplicationSubmittedAt = isoAt(-10 * DAY_MS);
  const authorApplicationReviewedAt = isoAt(-7 * DAY_MS);
  const authorApplicationRecord = {
    fullName: USERS.author.fullName,
    birthDate: "1995-08-17",
    documentType: "DNI",
    documentNumber: "30111222",
    country: "Argentina",
    province: "Cordoba",
    city: "Cordoba",
    address: "Av. Demo 123",
    documentFrontUrl: publicUrlFor(PUBLIC_BUCKET, authorDocFrontPath),
    documentBackUrl: publicUrlFor(PUBLIC_BUCKET, authorDocBackPath),
    status: "approved",
    submittedAt: authorApplicationSubmittedAt,
    archived: false,
  };

  await createNotification({
    id: authorApplicationId,
    user_id: authorAuthUser.id,
    actor_id: authorAuthUser.id,
    entity_id: authorAuthUser.id,
    type: "author_application",
    message: serializeAuthorApplication(authorApplicationRecord),
    is_read: false,
    created_at: authorApplicationSubmittedAt,
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: authorApplicationId,
    type: "author_application_history",
    message: serializeAuthorApplicationHistory({
      applicationId: authorApplicationId,
      action: "approved",
      actedAt: authorApplicationReviewedAt,
      reason: "Solicitud validada con documentos dummy.",
    }),
    is_read: true,
    created_at: authorApplicationReviewedAt,
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: authorApplicationId,
    type: "author_application_update",
    message:
      "aprobó tu solicitud para vender contenido. Ya puedes crear publicaciones.",
    is_read: false,
    created_at: authorApplicationReviewedAt,
  });

  await createNotificationThread({
    userId: authorAuthUser.id,
    topic: "author_application",
    subject: "Solicitud de autor",
    sourceType: "author_application",
    sourceId: authorApplicationId,
    allowUserReply: false,
    createdBy: adminAuthUser.id,
    messages: [
      {
        senderId: adminAuthUser.id,
        senderRole: "admin",
        body: "Aprobamos tu solicitud de autor. Ya puedes publicar y monetizar.",
        createdAt: authorApplicationReviewedAt,
      },
    ],
  });

  log("Creando retiro solicitado, historial y mensaje admin...");
  const withdrawalRequestedAt = isoAt(-16 * HOUR_MS);
  const { withdrawalId, monthKey } = await createWithdrawalRequest({
    authorUserId: authorAuthUser.id,
    amount: 60000,
    requestedAt: withdrawalRequestedAt,
  });

  await createNotification({
    id: withdrawalId,
    user_id: authorAuthUser.id,
    actor_id: authorAuthUser.id,
    entity_id: authorAuthUser.id,
    type: "withdrawal_request",
    message: serializeWithdrawalRecord({
      amount: 60000,
      status: "requested",
      requestedAt: withdrawalRequestedAt,
      monthKey,
    }),
    is_read: true,
    created_at: withdrawalRequestedAt,
  });
  await createNotification({
    user_id: adminAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: withdrawalId,
    type: "withdrawal_history",
    message: serializeWithdrawalHistory({
      withdrawalId,
      status: "requested",
      amount: 60000,
      actedAt: isoAt(-15 * HOUR_MS),
      reason: "Solicitud recibida y en revision.",
    }),
    is_read: true,
    created_at: isoAt(-15 * HOUR_MS),
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: withdrawalId,
    type: "withdrawal_update",
    message: "recibió tu solicitud de retiro y quedó en revisión.",
    is_read: false,
    created_at: isoAt(-15 * HOUR_MS),
  });

  await createNotificationThread({
    userId: authorAuthUser.id,
    topic: "withdrawal",
    subject: "Retiro de saldo",
    sourceType: "withdrawal",
    sourceId: withdrawalId,
    allowUserReply: true,
    createdBy: adminAuthUser.id,
    messages: [
      {
        senderId: adminAuthUser.id,
        senderRole: "admin",
        body: "Recibimos tu solicitud de retiro dummy. Queda en revisión hasta nuevo aviso.",
        createdAt: isoAt(-15 * HOUR_MS),
      },
      {
        senderId: authorAuthUser.id,
        senderRole: "user",
        body: "Perfecto, quedo atento a la acreditación.",
        createdAt: isoAt(-14 * HOUR_MS),
      },
    ],
  });

  log("Creando reportes y moderacion...");
  const reviewedReportId = crypto.randomUUID();
  const reviewedReportAt = isoAt(-12 * HOUR_MS);
  await createNotification({
    id: reviewedReportId,
    user_id: authorAuthUser.id,
    actor_id: buyerAuthUser.id,
    entity_id: freeAlbumBundle.album.id,
    type: "content_report",
    message: serializeContentReport({
      albumId: freeAlbumBundle.album.id,
      reason: "Contenido fuera de contexto",
      reportedAt: reviewedReportAt,
      status: "reviewed",
      archived: false,
    }),
    is_read: true,
    created_at: reviewedReportAt,
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: freeAlbumBundle.album.id,
    type: "moderation_action",
    message: serializeModerationAction({
      reportId: reviewedReportId,
      albumId: freeAlbumBundle.album.id,
      action: "reviewed",
      reason: "Contenido aprobado y mantenido en el sitio.",
      actedAt: isoAt(-11 * HOUR_MS),
    }),
    is_read: true,
    created_at: isoAt(-11 * HOUR_MS),
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: freeAlbumBundle.album.id,
    type: "moderation_content_state",
    message: serializeModerationContentState({
      albumId: freeAlbumBundle.album.id,
      action: "approved",
      actedAt: isoAt(-11 * HOUR_MS),
      actorId: adminAuthUser.id,
      reason: "Contenido aprobado y mantenido en el sitio.",
    }),
    is_read: true,
    created_at: isoAt(-11 * HOUR_MS),
  });

  const removedReportId = crypto.randomUUID();
  const removedReportAt = isoAt(-10 * HOUR_MS);
  await createNotification({
    id: removedReportId,
    user_id: authorAuthUser.id,
    actor_id: buyerAuthUser.id,
    entity_id: moderatedAlbumBundle.album.id,
    type: "content_report",
    message: serializeContentReport({
      albumId: moderatedAlbumBundle.album.id,
      reason: "Contenido sexual explícito",
      reportedAt: removedReportAt,
      status: "removed",
      archived: false,
    }),
    is_read: true,
    created_at: removedReportAt,
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: moderatedAlbumBundle.album.id,
    type: "moderation_action",
    message: serializeModerationAction({
      reportId: removedReportId,
      albumId: moderatedAlbumBundle.album.id,
      action: "removed",
      reason: "Incumple las políticas de FanPush.",
      actedAt: isoAt(-9 * HOUR_MS),
    }),
    is_read: true,
    created_at: isoAt(-9 * HOUR_MS),
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: moderatedAlbumBundle.album.id,
    type: "moderation_archive",
    message: serializeModerationArchive({
      album: {
        id: moderatedAlbumBundle.album.id,
        user_id: moderatedAlbumBundle.album.user_id,
        description: moderatedAlbumBundle.album.description,
        price: Number(moderatedAlbumBundle.album.price || 0),
        created_at: moderatedAlbumBundle.album.created_at,
      },
      posts: moderatedAlbumBundle.posts.map((post) => ({
        id: post.id,
        user_id: post.user_id,
        media_url: post.media_url,
        media_type: post.media_type,
        is_locked: post.is_locked,
        likes_count: post.likes_count,
        caption: post.caption,
        created_at: post.created_at,
      })),
      archivedAt: isoAt(-9 * HOUR_MS),
    }),
    is_read: true,
    created_at: isoAt(-9 * HOUR_MS),
  });
  await createNotification({
    user_id: authorAuthUser.id,
    actor_id: adminAuthUser.id,
    entity_id: moderatedAlbumBundle.album.id,
    type: "content_removed_update",
    message: "eliminó una de tus publicaciones. Motivo: Incumple las políticas de FanPush.",
    is_read: false,
    created_at: isoAt(-9 * HOUR_MS),
  });

  await createNotificationThread({
    userId: authorAuthUser.id,
    topic: "moderation",
    subject: "Moderación de contenido",
    sourceType: "moderation_album",
    sourceId: moderatedAlbumBundle.album.id,
    allowUserReply: true,
    createdBy: adminAuthUser.id,
    messages: [
      {
        senderId: adminAuthUser.id,
        senderRole: "admin",
        body: "Tu publicación fue removida en este entorno dummy. Motivo: Incumple las políticas de FanPush.",
        createdAt: isoAt(-9 * HOUR_MS),
      },
      {
        senderId: authorAuthUser.id,
        senderRole: "user",
        body: "Entendido, era solo para probar el flujo de moderación.",
        createdAt: isoAt(-8 * HOUR_MS),
      },
    ],
  });

  const moderatedPostIds = moderatedAlbumBundle.posts.map((post) => post.id);
  if (moderatedPostIds.length > 0) {
    const { error: deleteLinksError } = await admin
      .from("album_posts")
      .delete()
      .eq("album_id", moderatedAlbumBundle.album.id);
    throwIfError(deleteLinksError, "No se pudieron borrar los links del album moderado");

    const { error: deletePostsError } = await admin
      .from("posts")
      .delete()
      .in("id", moderatedPostIds);
    throwIfError(deletePostsError, "No se pudieron borrar los posts moderados");
  }

  const { error: deleteAlbumError } = await admin
    .from("albums")
    .delete()
    .eq("id", moderatedAlbumBundle.album.id);
  throwIfError(deleteAlbumError, "No se pudo borrar el album moderado");

  log("Creando hilo de soporte manual para el comprador...");
  await createNotificationThread({
    userId: buyerAuthUser.id,
    topic: "support",
    subject: "Consulta manual de soporte",
    sourceType: "support_seed",
    sourceId: buyerAuthUser.id,
    allowUserReply: true,
    createdBy: adminAuthUser.id,
    messages: [
      {
        senderId: adminAuthUser.id,
        senderRole: "admin",
        body: "Hola, este es un hilo manual dummy para probar el inbox admin.",
        createdAt: isoAt(-6 * HOUR_MS),
      },
      {
        senderId: buyerAuthUser.id,
        senderRole: "user",
        body: "Perfecto, ya pude comprar el album premium y queria confirmar el acceso.",
        createdAt: isoAt(-5 * HOUR_MS),
      },
      {
        senderId: adminAuthUser.id,
        senderRole: "admin",
        body: "Acceso confirmado. Puedes borrar este hilo cuando reinicies la base para lanzamiento.",
        createdAt: isoAt(-4 * HOUR_MS),
      },
    ],
  });

  log("Seed dummy creado correctamente.");
  log("");
  log("Credenciales de prueba:");
  log(`- Admin:  ${USERS.admin.email} / ${USERS.admin.password}`);
  log(`- Author: ${USERS.author.email} / ${USERS.author.password}`);
  log(`- Buyer:  ${USERS.buyer.email} / ${USERS.buyer.password}`);
  log("");
  log("Datos sembrados:");
  log(`- Album gratis activo: ${freeAlbumBundle.album.id}`);
  log(`- Album premium activo: ${premiumAlbumBundle.album.id}`);
  log(`- Compra interna: ${purchaseTransactionId ?? "ok"}`);
  log(`- Propina interna: ${tipTransactionId ?? "ok"}`);
  log(`- Solicitud de autor: ${authorApplicationId}`);
  log(`- Retiro solicitado: ${withdrawalId}`);
  log(`- Seed tag: ${SEED_TAG}`);
}

async function cleanSeedData() {
  const seedUsers = await listSeedPublicUsers();
  if (seedUsers.length === 0) {
    log("No se encontraron usuarios dummy previos.");
    return;
  }

  const userIds = seedUsers.map((user) => user.id);
  log(`Borrando seed previo para ${seedUsers.map((user) => user.username).join(", ")}...`);

  const { data: transactions, error: transactionSelectError } = await admin
    .from("ledger_transactions")
    .select("id")
    .or(
      [
        `buyer_user_id.in.(${userIds.join(",")})`,
        `recipient_user_id.in.(${userIds.join(",")})`,
      ].join(","),
    );
  throwIfError(transactionSelectError, "No se pudieron leer ledger_transactions dummy");
  const transactionIds = (transactions ?? []).map((row) => row.id);

  if (userIds.length > 0) {
    const { error: providerError } = await admin
      .from("provider_movements")
      .delete()
      .or(
        [
          `user_id.in.(${userIds.join(",")})`,
          `external_reference.like.${SEED_PAYMENT_PREFIX}%`,
        ].join(","),
      );
    throwIfError(providerError, "No se pudo limpiar provider_movements");

    if (transactionIds.length > 0) {
      const { error: entriesError } = await admin
        .from("ledger_entries")
        .delete()
        .in("transaction_id", transactionIds);
      throwIfError(entriesError, "No se pudo limpiar ledger_entries");

      const { error: transactionsError } = await admin
        .from("ledger_transactions")
        .delete()
        .in("id", transactionIds);
      throwIfError(transactionsError, "No se pudo limpiar ledger_transactions");
    }
  }

  for (const userId of userIds) {
    await Promise.all([
      removeIfExists(PUBLIC_BUCKET, buildSeedAvatarPath(userId)),
      removeIfExists(PUBLIC_BUCKET, buildSeedDocumentPath(userId, "front")),
      removeIfExists(PUBLIC_BUCKET, buildSeedDocumentPath(userId, "back")),
      removeIfExists(PUBLIC_BUCKET, buildSeedPublicPath(userId, "free-look-1")),
      removeIfExists(PUBLIC_BUCKET, buildSeedPublicPath(userId, "moderated-look-1")),
      removeIfExists(PUBLIC_BUCKET, buildLockedPreviewPath(userId, "seed-premium-a")),
      removeIfExists(PUBLIC_BUCKET, buildLockedPreviewPath(userId, "seed-premium-b")),
      removeIfExists(PREMIUM_BUCKET, buildPremiumPath(userId, "seed-premium-a")),
      removeIfExists(PREMIUM_BUCKET, buildPremiumPath(userId, "seed-premium-b")),
    ]);
  }

  for (const userId of userIds) {
    await deleteAuthUser(userId);
  }

  log("Seed dummy limpiado.");
}

const printHelp = () => {
  log("Uso:");
  log("  node scripts/seed-dummy-data.mjs reseed");
  log("  node scripts/seed-dummy-data.mjs seed");
  log("  node scripts/seed-dummy-data.mjs clean");
};

const run = async () => {
  switch (MODE) {
    case "reseed":
      await createSeedData({ cleanFirst: true });
      break;
    case "seed":
      await createSeedData({ cleanFirst: false });
      break;
    case "clean":
      await ensureBuckets();
      await cleanSeedData();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      exitWithError(`Modo no soportado: ${MODE}`);
  }
};

run().catch((error) => {
  exitWithError(
    error instanceof Error ? `Fallo el seed dummy: ${error.message}` : "Fallo el seed dummy.",
  );
});
