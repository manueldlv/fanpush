import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth/session";
import {
  listUserNotificationActivity,
  listUserNotificationThreads,
} from "@/lib/server/repositories/notification-center";

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const [activity, threads] = await Promise.all([
      listUserNotificationActivity(admin, user.id, 80),
      listUserNotificationThreads(admin, user.id, 80),
    ]);

    return NextResponse.json({ ok: true, activity, threads });
  } catch (requestError) {
    return NextResponse.json(
      {
        error:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar el centro de notificaciones.",
      },
      { status: 500 },
    );
  }
}
