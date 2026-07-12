export interface IBackupProvider {
  /**
   * Run a backup copy of the target database
   * @param destinationPath Local filesystem path to write the backup file
   */
  backup(destinationPath: string): Promise<void>;

  /**
   * Restore database schema and state from a backup copy
   * @param sourcePath Path to the backup database file
   */
  restore(sourcePath: string): Promise<void>;
}
