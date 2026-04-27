import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MessageItem, ThreadItem, ThreadPageInfo, ThreadSummaryItem } from "@/lib/chatTypes";

type ThreadCacheState = {
  summary: ThreadSummaryItem;
  messages: MessageItem[];
  hydrated: boolean;
  initialLoading: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  oldestCursor: string | null;
  lastFetchedAt: number | null;
};

type ChatState = {
  threadOrder: string[];
  threadsById: Record<string, ThreadCacheState>;
  activeThreadId: string | null;
  threadsHydrated: boolean;
  loadingThreads: boolean;
};

const initialState: ChatState = {
  threadOrder: [],
  threadsById: {},
  activeThreadId: null,
  threadsHydrated: false,
  loadingThreads: false,
};

const toSummary = (thread: ThreadItem | ThreadSummaryItem): ThreadSummaryItem => ({
  id: thread.id,
  participantUserId: thread.participantUserId,
  username: thread.username,
  fullName: thread.fullName,
  handle: thread.handle,
  preview: thread.preview,
  avatarUrl: thread.avatarUrl,
  participantIsAuthor: thread.participantIsAuthor,
  lastSeen: thread.lastSeen,
  lastMessageAt: thread.lastMessageAt,
  unread: Boolean(thread.unread),
  pinned: Boolean(thread.pinned),
});

const mergeMessages = (current: MessageItem[], incoming: MessageItem[]) => {
  const byId = new Map<string, MessageItem>();
  [...current, ...incoming].forEach((message) => {
    const key = message.id;
    byId.set(key, message);
  });
  return Array.from(byId.values());
};

const sortThreads = (state: ChatState) => {
  state.threadOrder.sort((a, b) => {
    const threadA = state.threadsById[a]?.summary;
    const threadB = state.threadsById[b]?.summary;
    if (!threadA || !threadB) return 0;
    if (Number(Boolean(threadB.pinned)) !== Number(Boolean(threadA.pinned))) {
      return Number(Boolean(threadB.pinned)) - Number(Boolean(threadA.pinned));
    }
    return (
      new Date(threadB.lastMessageAt ?? 0).getTime() -
      new Date(threadA.lastMessageAt ?? 0).getTime()
    );
  });
};

const ensureThreadState = (state: ChatState, summary: ThreadSummaryItem) => {
  if (!state.threadsById[summary.id]) {
    state.threadsById[summary.id] = {
      summary,
      messages: [],
      hydrated: false,
      initialLoading: false,
      loadingOlder: false,
      hasMoreOlder: false,
      oldestCursor: null,
      lastFetchedAt: null,
    };
  }
  return state.threadsById[summary.id];
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    hydrateThreadsStart(state) {
      state.loadingThreads = state.threadOrder.length === 0;
    },
    hydrateThreadsSuccess(state, action: PayloadAction<ThreadSummaryItem[]>) {
      state.loadingThreads = false;
      state.threadsHydrated = true;
      action.payload.forEach((thread) => {
        const entry = ensureThreadState(state, thread);
        entry.summary = thread;
      });
      state.threadOrder = Array.from(new Set(action.payload.map((thread) => thread.id)));
      sortThreads(state);
      if (!state.activeThreadId) {
        state.activeThreadId = state.threadOrder[0] ?? null;
      }
    },
    hydrateThreadsError(state) {
      state.loadingThreads = false;
      state.threadsHydrated = true;
    },
    setActiveThreadId(state, action: PayloadAction<string | null>) {
      state.activeThreadId = action.payload;
    },
    hydrateThreadDetailStart(state, action: PayloadAction<{ threadId: string }>) {
      const entry = state.threadsById[action.payload.threadId];
      if (entry) entry.initialLoading = true;
    },
    hydrateThreadDetailSuccess(
      state,
      action: PayloadAction<{ thread: ThreadItem; pageInfo: ThreadPageInfo }>,
    ) {
      const summary = toSummary(action.payload.thread);
      const entry = ensureThreadState(state, summary);
      entry.summary = summary;
      entry.messages = action.payload.thread.messages;
      entry.hydrated = true;
      entry.initialLoading = false;
      entry.loadingOlder = false;
      entry.hasMoreOlder = action.payload.pageInfo.hasMoreOlder;
      entry.oldestCursor = action.payload.pageInfo.oldestCursor;
      entry.lastFetchedAt = Date.now();
      if (!state.threadOrder.includes(summary.id)) state.threadOrder.push(summary.id);
      sortThreads(state);
    },
    hydrateThreadDetailError(state, action: PayloadAction<{ threadId: string }>) {
      const entry = state.threadsById[action.payload.threadId];
      if (entry) entry.initialLoading = false;
    },
    loadOlderStart(state, action: PayloadAction<{ threadId: string }>) {
      const entry = state.threadsById[action.payload.threadId];
      if (entry) entry.loadingOlder = true;
    },
    loadOlderSuccess(
      state,
      action: PayloadAction<{ threadId: string; messages: MessageItem[]; pageInfo: ThreadPageInfo }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      entry.messages = mergeMessages(action.payload.messages, entry.messages);
      entry.loadingOlder = false;
      entry.hasMoreOlder = action.payload.pageInfo.hasMoreOlder;
      entry.oldestCursor = action.payload.pageInfo.oldestCursor;
      entry.lastFetchedAt = Date.now();
    },
    loadOlderError(state, action: PayloadAction<{ threadId: string }>) {
      const entry = state.threadsById[action.payload.threadId];
      if (entry) entry.loadingOlder = false;
    },
    upsertThreadFromDetail(
      state,
      action: PayloadAction<{ thread: ThreadItem; pageInfo?: ThreadPageInfo }>,
    ) {
      const summary = toSummary(action.payload.thread);
      const entry = ensureThreadState(state, summary);
      entry.summary = summary;
      entry.messages = action.payload.thread.messages;
      entry.hydrated = true;
      entry.initialLoading = false;
      entry.loadingOlder = false;
      entry.lastFetchedAt = Date.now();
      if (action.payload.pageInfo) {
        entry.hasMoreOlder = action.payload.pageInfo.hasMoreOlder;
        entry.oldestCursor = action.payload.pageInfo.oldestCursor;
      }
      if (!state.threadOrder.includes(summary.id)) state.threadOrder.push(summary.id);
      sortThreads(state);
    },
    enqueueOutgoingText(
      state,
      action: PayloadAction<{ threadId: string; message: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      entry.messages.push(action.payload.message);
      entry.summary.preview =
        action.payload.message.kind === "text" ? action.payload.message.body : entry.summary.preview;
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    enqueueOutgoingPremium(
      state,
      action: PayloadAction<{ threadId: string; message: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      entry.messages.push(action.payload.message);
      entry.summary.preview = "Contenido privado";
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    enqueueOutgoingAttachment(
      state,
      action: PayloadAction<{ threadId: string; message: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      entry.messages.push(action.payload.message);
      entry.summary.preview =
        action.payload.message.kind === "attachment"
          ? action.payload.message.attachments.length > 1
            ? `${action.payload.message.attachments.length} archivos`
            : action.payload.message.attachments[0]?.kind === "video"
              ? "Video"
              : "Foto"
          : entry.summary.preview;
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    confirmOutgoingText(
      state,
      action: PayloadAction<{ threadId: string; localId: string; serverMessage: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const index = entry.messages.findIndex((message) => message.id === action.payload.localId);
      if (index >= 0) {
        entry.messages[index] = action.payload.serverMessage;
      } else {
        entry.messages.push(action.payload.serverMessage);
      }
      entry.summary.preview =
        action.payload.serverMessage.kind === "text"
          ? action.payload.serverMessage.body
          : entry.summary.preview;
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    confirmOutgoingPremium(
      state,
      action: PayloadAction<{ threadId: string; localId: string; serverMessage: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const index = entry.messages.findIndex((message) => message.id === action.payload.localId);
      if (index >= 0) {
        entry.messages[index] = action.payload.serverMessage;
      } else {
        entry.messages.push(action.payload.serverMessage);
      }
      entry.summary.preview = "Contenido privado";
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    confirmOutgoingAttachment(
      state,
      action: PayloadAction<{ threadId: string; localId: string; serverMessage: MessageItem }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const index = entry.messages.findIndex((message) => message.id === action.payload.localId);
      if (index >= 0) {
        entry.messages[index] = action.payload.serverMessage;
      } else {
        entry.messages.push(action.payload.serverMessage);
      }
      entry.summary.preview =
        action.payload.serverMessage.kind === "attachment"
          ? action.payload.serverMessage.attachments.length > 1
            ? `${action.payload.serverMessage.attachments.length} archivos`
            : action.payload.serverMessage.attachments[0]?.kind === "video"
              ? "Video"
              : "Foto"
          : entry.summary.preview;
      entry.summary.lastMessageAt = new Date().toISOString();
      entry.summary.lastSeen = "Ahora";
      entry.lastFetchedAt = Date.now();
      state.threadOrder = [action.payload.threadId, ...state.threadOrder.filter((id) => id !== action.payload.threadId)];
      sortThreads(state);
    },
    failOutgoingText(
      state,
      action: PayloadAction<{ threadId: string; localId: string; error: string }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const message = entry.messages.find((item) => item.id === action.payload.localId);
      if (message && message.kind === "text") {
        message.deliveryStatus = "failed";
        message.syncError = action.payload.error;
      }
    },
    failOutgoingPremium(
      state,
      action: PayloadAction<{ threadId: string; localId: string; error: string }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const message = entry.messages.find((item) => item.id === action.payload.localId);
      if (message && message.kind === "premium") {
        message.deliveryStatus = "failed";
        message.syncError = action.payload.error;
      }
    },
    failOutgoingAttachment(
      state,
      action: PayloadAction<{ threadId: string; localId: string; error: string }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      const message = entry.messages.find((item) => item.id === action.payload.localId);
      if (message && message.kind === "attachment") {
        message.deliveryStatus = "failed";
        message.syncError = action.payload.error;
      }
    },
    removeLocalMessage(
      state,
      action: PayloadAction<{ threadId: string; messageId: string }>,
    ) {
      const entry = state.threadsById[action.payload.threadId];
      if (!entry) return;
      entry.messages = entry.messages.filter(
        (message) => message.id !== action.payload.messageId,
      );
    },
    removeThread(state, action: PayloadAction<{ threadId: string }>) {
      delete state.threadsById[action.payload.threadId];
      state.threadOrder = state.threadOrder.filter((id) => id !== action.payload.threadId);
      if (state.activeThreadId === action.payload.threadId) {
        state.activeThreadId = state.threadOrder[0] ?? null;
      }
    },
    markThreadReadLocal(state, action: PayloadAction<{ threadId: string }>) {
      const entry = state.threadsById[action.payload.threadId];
      if (entry) entry.summary.unread = false;
    },
  },
});

export const {
  hydrateThreadsStart,
  hydrateThreadsSuccess,
  hydrateThreadsError,
  setActiveThreadId,
  hydrateThreadDetailStart,
  hydrateThreadDetailSuccess,
  hydrateThreadDetailError,
  loadOlderStart,
  loadOlderSuccess,
  loadOlderError,
  upsertThreadFromDetail,
  enqueueOutgoingText,
  enqueueOutgoingPremium,
  enqueueOutgoingAttachment,
  confirmOutgoingText,
  confirmOutgoingPremium,
  confirmOutgoingAttachment,
  failOutgoingText,
  failOutgoingPremium,
  failOutgoingAttachment,
  removeLocalMessage,
  removeThread,
  markThreadReadLocal,
} = chatSlice.actions;

export default chatSlice.reducer;
