import Image from "next/image";
import { Flash, Label, Submit, inputClass } from "@/components/ui";
import { signIn, signOut } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notAdmin = error === "not-admin";
  return (
    <main className="login-layout">
      <aside className="login-story">
        <span className="login-eyebrow">MAN UP · MINISTRY ADMIN</span>
        <div><h2>Stronger men.<br />Stronger <em>together.</em></h2><p>Care for your people. Equip your leaders. Make room for every man to belong.</p></div>
        <span className="login-eyebrow">MEN OF FAITH. LEADERS OF PURPOSE.</span>
      </aside>
      <div className="login-form-panel"><div className="login-form-content">
      <div>
        <Image src="/logo.png" alt="Man Up, Love First Christian Center Men's Fellowship" width={72} height={72}
               className="mb-4 rounded-2xl" priority />
        <h1 className="text-2xl font-bold">Welcome back.</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in to care for your ministry.</p>
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
            <input name="email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required className={inputClass} />
          </Label>
          <Label text="Password">
            <input name="password" type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} required className={inputClass} />
          </Label>
          <Submit>Sign in</Submit>
        </form>
      )}
      <p className="login-footnote">Looking for your group? Open the Man Up mobile app.</p>
      </div></div>
    </main>
  );
}
