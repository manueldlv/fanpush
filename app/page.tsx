"use client";

import { useState } from "react";
import FeedLayout from "@/components/FeedLayout";
import NotificationsPanel from "@/components/NotificationsPanel";
import SearchPanel from "@/components/SearchPanel";
import SidebarLeft from "@/components/SidebarLeft";
import SidebarRight from "@/components/SidebarRight";

export default function Home() {

  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      
      <SidebarLeft
        searchOpen={searchOpen}
        onSearchClick={() => {
          setNotificationsOpen(false);
          setSearchOpen(true);
        }}
        notificationsOpen={notificationsOpen}
        onNotificationsClick={() => {
          setSearchOpen(false);
          setNotificationsOpen(true);
        }}
      />

      <SearchPanel 
        open={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />

      <div className="flex h-full pl-60">
        <div className="mx-auto flex h-full w-full max-w-[1200px] gap-8 px-6 py-8">
          <FeedLayout />
          <SidebarRight />
        </div>
      </div>

    </div>
  );
}
