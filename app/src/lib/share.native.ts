import { Share } from 'react-native';

/** Phone: hand the full JSON to the share sheet (save to Files, email it to yourself, and so on). */
export async function shareJson(filename: string, json: string): Promise<void> {
  await Share.share({ title: filename, message: json });
}
