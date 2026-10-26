import { useState, type FormEvent } from 'react';
import { AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/auth-api';

export function SignInPage({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await signIn(email, password);
			await onSignedIn();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : '로그인하지 못했어요.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10">
			<section className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
				<div className="mb-8 flex items-center gap-2">
					<AudioLines className="size-6" />
					<span className="text-xl font-semibold tracking-tight">
						lingo<span className="text-muted-foreground">.</span>
					</span>
				</div>
				<h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
				<p className="mt-2 text-sm text-muted-foreground">계정 정보를 입력해 주세요.</p>
				<form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
					<div className="space-y-2">
						<Label htmlFor="email">이메일</Label>
						<Input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">비밀번호</Label>
						<Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
					</div>
					{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
					<Button className="min-h-11 w-full" type="submit" disabled={submitting}>
						{submitting ? '로그인 중…' : '로그인'}
					</Button>
				</form>
			</section>
		</main>
	);
}
