export function getEnvFilePath() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return '.env.prod'
    case 'development':
    default:
      return '.env.dev'
  }
}
