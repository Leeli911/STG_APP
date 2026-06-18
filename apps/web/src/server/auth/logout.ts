type SignOutClient = {
  auth: {
    signOut: () => Promise<{ error: unknown }>;
  };
};

export async function signOutUser(client: SignOutClient) {
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }

  return "/login";
}
