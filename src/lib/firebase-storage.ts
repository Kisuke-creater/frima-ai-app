import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { getFirebaseStorage } from "./firebase-client";

export interface UploadItemImageInput {
  dataUrl: string;
  mimeType: string;
}

function sanitizeFileExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function createStorageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadItemImages(
  uid: string,
  images: UploadItemImageInput[],
): Promise<string[]> {
  if (images.length === 0) return [];

  const storage = getFirebaseStorage();
  const uploadedUrls = await Promise.all(
    images.map(async (image) => {
      const extension = sanitizeFileExtension(image.mimeType);
      const fileRef = ref(storage, `users/${uid}/items/${createStorageId()}.${extension}`);
      await uploadString(fileRef, image.dataUrl, "data_url", {
        contentType: image.mimeType || "image/jpeg",
      });
      return getDownloadURL(fileRef);
    }),
  );

  return uploadedUrls;
}
