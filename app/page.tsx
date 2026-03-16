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
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      
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

      <div className="flex min-h-screen md:pl-60">
        <div className="mx-auto flex w-full max-w-none gap-6 px-4 py-6 md:max-w-[1200px] md:gap-8 md:px-6 md:py-8">
          <FeedLayout />
          <SidebarRight />
        </div>
      </div>

    </div>
  );
}
