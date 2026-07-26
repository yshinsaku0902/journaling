export function SignInPrompt() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-rule p-8 text-center">
        <h1 className="text-xl font-bold text-navy">ジャーナル手帳</h1>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
          毎朝のジャーナリングを、Outlookの予定つきで。
          <br />
          Microsoft アカウントでログインしてください。
        </p>
        <a
          href="/api/auth/signin"
          className="mt-6 inline-block w-full rounded-lg bg-navy text-white py-3 font-medium hover:opacity-90 transition"
        >
          Microsoft でログイン
        </a>
      </div>
    </main>
  );
}
