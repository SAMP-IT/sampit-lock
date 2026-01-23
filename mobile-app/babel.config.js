module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
        whitelist: [
          'SUPABASE_URL',
          'SUPABASE_ANON_KEY',
          'BACKEND_API_URL',
          'TTLOCK_CLIENT_ID',
          'TTLOCK_CLIENT_SECRET',
          'TTLOCK_API_BASE_URL'
        ]
      }]
    ]
  };
};