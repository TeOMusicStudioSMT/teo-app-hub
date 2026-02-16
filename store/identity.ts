import { atom, PrimitiveAtom } from 'jotai';
import { EssenceIdentity } from '../lib/identity/types';

// Simplified Writable Atom definition
export const essenceIdentityAtom = atom<EssenceIdentity | null>(null) as PrimitiveAtom<EssenceIdentity | null>;


// Controls the visibility of the username claim modal.
export const isClaimUsernameModalOpenAtom: PrimitiveAtom<boolean> = atom<boolean>(false);

// Controls the visibility of the avatar selection modal.
export const isAvatarSelectionModalOpenAtom: PrimitiveAtom<boolean> = atom<boolean>(false);

// Controls the visibility and context of the Protective Mode modal.
interface ProtectiveModeState {
    isOpen: boolean;
    reportId?: string;
    onConfirm?: () => void;
}
export const protectiveModeAtom: PrimitiveAtom<ProtectiveModeState> = atom<ProtectiveModeState>({ isOpen: false });