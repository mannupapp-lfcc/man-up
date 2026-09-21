import Image from "next/image";
import { Flash, Label, Submit, inputClass } from "@/components/ui";
import { signIn, signOut } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notAdmin = error === "not-admin";
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div>
        <Image src="/logo.png" alt="Man Up, Love First Christian Center Men's Fellowship" width={128} height={128}
               className="mb-4 rounded-2xl" priority />
        <h1 className="text-2xl font-bold">Man Up Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">For ministry admins. Men use the phone app.</p>
      </div>
      {notAdmin ? (
        <>
          <Flash error="This account is not a ministry admin." />
          <form action={signOut}>
            <Submit variant="secondary">Sign out</Submit>
          </form>
        </>
      ) : (
        <form action={signIn} className="flex flex-col gap-4">
          <Flash error={error} />
          <Label text="Email">
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </Label>
          <Label text="Password">
            <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
          </Label>
          <Submit>Sign in</Submit>
        </form>
      )}
    </main>
  );
}
