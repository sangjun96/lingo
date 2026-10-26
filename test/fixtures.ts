export const learningResponse = {
	translation: '주말에는 보통 무엇을 하세요?',
	explanation: 'usually는 평소의 습관을 물을 때 써요.',
	suggestions: [
		{
			label: '집에서 쉬기',
			text: 'I usually relax at home.',
			translation: '보통 집에서 쉬어요.',
			explanation: 'relax는 편하게 쉬다는 뜻이에요.',
		},
		{
			label: '친구 만나기',
			text: 'I often see my friends.',
			translation: '친구들을 자주 만나요.',
			explanation: 'often은 자주라는 뜻이에요.',
		},
		{
			label: '되묻기',
			text: 'It depends. How about you?',
			translation: '그때그때 달라요. 당신은요?',
			explanation: 'How about you?로 상대에게 되물을 수 있어요.',
		},
	],
	feedback: {
		improved: { text: 'I went shopping yesterday.', translation: '어제 쇼핑했어요.', explanation: '어제 일이므로 went를 써요.' },
		explanation: 'yesterday와 함께 과거형 went를 써보세요.',
	},
};

export function textResponse(text: string) {
	return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

export function wavBytes() {
	const bytes = new Uint8Array(46);
	const view = new DataView(bytes.buffer);
	for (const [offset, text] of [
		[0, 'RIFF'],
		[8, 'WAVE'],
		[12, 'fmt '],
		[36, 'data'],
	] as const) {
		bytes.set(new TextEncoder().encode(text), offset);
	}
	view.setUint32(4, 38, true);
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, 24000, true);
	view.setUint32(28, 48000, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	view.setUint32(40, 2, true);
	return bytes;
}
