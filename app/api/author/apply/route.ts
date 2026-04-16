import { NextResponse } from "next/server";
import { getAuthorApplicationByUserId } from "@/lib/server/repositories/author-applications";
import { type AuthorApplicationRecord } from "@/lib/authorApplications";
import { ALLOWED_IMAGE_TYPES, MAX_DOCUMENT_IMAGE_BYTES } from "@/lib/imageFiles";
import { saveAuthorApplication } from "@/lib/server/repositories/author-applications";
import { getAuthenticatedUser } from "@/lib/server/auth/session";

const getFileExtension = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  const parts = normalized.split(".");
  if (parts.length < 2) return "jpg";
  return parts.pop() || "jpg";
};

export async function GET(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const application = await getAuthorApplicationByUserId(admin, user.id);

    return NextResponse.json({
      ok: true,
      status: application?.record?.status ?? "idle",
      current: application?.record ?? null,
    });
  } catch (requestError) {
    return NextResponse.json(
      {
        error:
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la solicitud.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { admin, user, error } = await getAuthenticatedUser(request);
    if (error || !admin || !user) {
      return NextResponse.json({ error: error ?? "No autorizado." }, { status: 401 });
    }

    const formData = await request.formData();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const birthDate = String(formData.get("birthDate") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    const documentNumber = String(formData.get("documentNumber") ?? "")
      .trim()
      .replace(/[^0-9a-zA-Z]/g, "")
      .slice(0, 20)
      .toUpperCase();
    const country = String(formData.get("country") ?? "").trim();
    const province = String(formData.get("province") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();

    const requiredFields = [
      fullName,
      birthDate,
      documentType,
      documentNumber,
      country,
      province,
      city,
      address,
    ];

    if (requiredFields.some((field) => !field)) {
      return NextResponse.json(
        { error: "Completa todos los datos y sube ambas fotos del documento." },
        { status: 400 },
      );
    }

    const frontFile = formData.get("documentFront");
    const backFile = formData.get("documentBack");
    if (!(frontFile instanceof File) || !(backFile instanceof File)) {
      return NextResponse.json(
        { error: "Debes subir frente y dorso del documento." },
        { status: 400 },
      );
    }

    if (
      !ALLOWED_IMAGE_TYPES.includes(frontFile.type) ||
      !ALLOWED_IMAGE_TYPES.includes(backFile.type)
    ) {
      return NextResponse.json(
        { error: "Las imágenes del documento deben ser JPG, PNG o WEBP." },
        { status: 400 },
      );
    }

    if (
      frontFile.size > MAX_DOCUMENT_IMAGE_BYTES ||
      backFile.size > MAX_DOCUMENT_IMAGE_BYTES
    ) {
      return NextResponse.json(
        { error: "Cada imagen del documento puede pesar hasta 10 MB." },
        { status: 400 },
      );
    }

    const parsedBirthDate = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - parsedBirthDate.getFullYear();
    const monthDiff = today.getMonth() - parsedBirthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < parsedBirthDate.getDate())
    ) {
      age -= 1;
    }

    if (!Number.isFinite(age) || age < 18) {
      return NextResponse.json(
        { error: "Debes ser mayor de 18 años para solicitar acceso como autor." },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const frontPath = `verifications/${user.id}/dni-front-${timestamp}.${getFileExtension(
      frontFile.name,
    )}`;
    const backPath = `verifications/${user.id}/dni-back-${timestamp}.${getFileExtension(
      backFile.name,
    )}`;

    const [frontBytes, backBytes] = await Promise.all([
      Buffer.from(await frontFile.arrayBuffer()),
      Buffer.from(await backFile.arrayBuffer()),
    ]);

    const [frontUpload, backUpload] = await Promise.all([
      admin.storage.from("Imagenes").upload(frontPath, frontBytes, {
        upsert: true,
        contentType: frontFile.type || "image/jpeg",
      }),
      admin.storage.from("Imagenes").upload(backPath, backBytes, {
        upsert: true,
        contentType: backFile.type || "image/jpeg",
      }),
    ]);

    if (frontUpload.error) {
      throw new Error(
        `No se pudo subir el frente del DNI: ${frontUpload.error.message}`,
      );
    }
    if (backUpload.error) {
      throw new Error(
        `No se pudo subir el dorso del DNI: ${backUpload.error.message}`,
      );
    }

    const documentFrontUrl =
      admin.storage.from("Imagenes").getPublicUrl(frontPath).data.publicUrl;
    const documentBackUrl =
      admin.storage.from("Imagenes").getPublicUrl(backPath).data.publicUrl;

    const payload: AuthorApplicationRecord = {
      fullName,
      birthDate,
      documentType,
      documentNumber,
      country,
      province,
      city,
      address,
      documentFrontUrl,
      documentBackUrl,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };

    const fallbackUsername =
      typeof user.user_metadata?.username === "string" &&
      user.user_metadata.username.trim()
        ? user.user_metadata.username.trim()
        : user.email?.split("@")[0] ?? "usuario";

    const { data: existingUserRow, error: selectUserError } = await admin
      .from("users")
      .select("id,username")
      .eq("id", user.id)
      .maybeSingle();

    if (selectUserError) {
      throw new Error(`No se pudo validar el usuario: ${selectUserError.message}`);
    }

    if (!existingUserRow) {
      const { error: insertUserError } = await admin.from("users").insert({
        id: user.id,
        username: fallbackUsername,
      });
      if (insertUserError) {
        throw new Error(`No se pudo crear el usuario público: ${insertUserError.message}`);
      }
    } else if (!existingUserRow.username?.trim()) {
      const { error: updateUserError } = await admin
        .from("users")
        .update({ username: fallbackUsername })
        .eq("id", user.id);
      if (updateUserError) {
        throw new Error(`No se pudo completar el nombre de usuario: ${updateUserError.message}`);
      }
    }

    await saveAuthorApplication({ admin, userId: user.id, record: payload });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo enviar la solicitud.",
      },
      { status: 500 },
    );
  }
}
