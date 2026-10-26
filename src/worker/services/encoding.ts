export function encodeBase64(bytes: Uint8Array) {
	let binary = '';
	for (let offset = 0; offset < bytes.length; offset += 16_384) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
	}
	return btoa(binary);
}

export function decodeBase64(value: string) {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
