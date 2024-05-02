import { User } from "@app/lib/definitions";
import { authConfig } from "@auth.config";
import { sql } from "@vercel/postgres";
import bcrypt from "bcrypt";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await sql`SELECT * from Users WHERE email=${email}`;
    return user.rows[0] as User; //* Had to use Type Assertion. I'm messed up at this point and doing very crazy stuff
  } catch (err) {
    throw new Error("Failed to fetch User");
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        //* Checking if we got the user or not
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) {
            return null;
          }
          //* Mathching f password is correct too
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) {
            return user;
          }
        }
        return null;
      },
    }),
  ],
});
