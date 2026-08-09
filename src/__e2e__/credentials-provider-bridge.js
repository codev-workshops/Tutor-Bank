module.exports = function CredentialsProvider(options) {
  return {
    id: "credentials",
    name: "Credentials",
    type: "credentials",
    credentials: {},
    authorize: () => null,
    options,
  }
}
