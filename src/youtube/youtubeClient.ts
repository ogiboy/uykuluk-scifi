export type YoutubeClient = {
  uploadPrivate(): Promise<never>;
  publishScheduled(): Promise<never>;
};

export function createDisabledYoutubeClient(): YoutubeClient {
  return {
    async uploadPrivate(): Promise<never> {
      throw new Error("YouTube upload is disabled in the MVP.");
    },
    async publishScheduled(): Promise<never> {
      throw new Error("YouTube public/scheduled publish is disabled in the MVP.");
    },
  };
}
