module.exports = {
  dependencies: {
    'react-native-sqlite-storage': {
      platforms: {
        android: {
          sourceDir: '../node_modules/react-native-sqlite-storage/platforms/android',
          packageImportPath: 'import org.pgsqlite.SQLitePluginPackage;',
          packageInstance: 'new SQLitePluginPackage()',
        },
        ios: null, // Disables scanning legacy iOS config to eliminate CLI warning
      },
    },
  },
};
