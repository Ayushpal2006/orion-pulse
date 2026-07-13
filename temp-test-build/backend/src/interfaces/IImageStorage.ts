export interface IImageStorage {
  /**
   * Upload an image from local filesystem to the storage provider
   * @param filePath Absolute path to the file on local disk
   * @returns Promise resolving to the secure HTTPS URL of the uploaded image
   */
  upload(filePath: string): Promise<string>;

  /**
   * Delete an image from the storage provider
   * @param url Secure HTTPS URL of the image
   */
  delete(url: string): Promise<void>;
}
