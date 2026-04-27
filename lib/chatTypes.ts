"use client";

export type AttachmentPreview = {
  id: string;
  name: string;
  kind: "foto" | "video";
  previewUrl: string;
  previewMode?: "preview" | "locked";
  file?: File;
};

export type MessageItem =
  | {
      id: string;
      localId?: string;
      kind: "text";
      sender: "me" | "them";
      body: string;
      createdAt: string;
      deliveryStatus?: "local" | "sent" | "failed";
      syncError?: string | null;
    }
  | {
      id: string;
      localId?: string;
      kind: "attachment";
      sender: "me" | "them";
      body?: string;
      attachments: AttachmentPreview[];
      createdAt: string;
      deliveryStatus?: "local" | "sent" | "failed";
      syncError?: string | null;
    }
  | {
      id: string;
      kind: "system";
      sender: "system";
      body: string;
      createdAt: string;
    }
  | {
      id: string;
      localId?: string;
      kind: "premium";
      sender: "me" | "them";
      title: string;
      caption: string;
      price: number;
      attachmentCount: number;
      attachmentPreviews: AttachmentPreview[];
      status: "locked" | "purchased";
      createdAt: string;
      deliveryStatus?: "local" | "sent" | "failed";
      syncError?: string | null;
    };

export type PremiumMessageItem = Extract<MessageItem, { kind: "premium" }>;

export type ChatPreviewState = {
  attachments: AttachmentPreview[];
  index: number;
  unlocked: boolean;
};

export type ThreadItem = {
  id: string;
  participantUserId: string;
  username: string;
  fullName: string;
  handle: string;
  preview: string;
  avatarUrl: string | null;
  participantIsAuthor: boolean;
  lastSeen: string;
  lastMessageAt?: string;
  unread?: boolean;
  pinned?: boolean;
  messages: MessageItem[];
};

export type ThreadSummaryItem = Omit<ThreadItem, "messages">;

export type ThreadPageInfo = {
  hasMoreOlder: boolean;
  oldestCursor: string | null;
};
