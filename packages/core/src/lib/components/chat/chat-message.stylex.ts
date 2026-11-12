import * as stylex from '@stylexjs/stylex';
import { sx, type StyleArg, type SvelteStyleAttrs } from '../../internal/sx.js';
import {
	colorVars,
	fontWeightVars,
	spacingVars,
	typeScaleVars
} from '../../styles/tokens.stylex.js';
import type { ChatDensity, ChatMessageSender } from './chat-context.svelte.js';
import { chatMessageVars } from './chat-message.vars.stylex.js';

/** Ported from the `styles` block in Astryx's `Chat/ChatMessage.tsx`. */
const styles = stylex.create({
	root: {
		display: 'flex',
		alignItems: 'flex-start',
		maxWidth: '100%'
	},
	rootGapCompact: {
		gap: spacingVars['--spacing-1-5']
	},
	rootGapBalanced: {
		gap: spacingVars['--spacing-2']
	},
	rootGapSpacious: {
		gap: spacingVars['--spacing-3']
	},
	rootAssistant: {
		flexDirection: 'row',
		justifyContent: 'flex-start'
	},
	rootUser: {
		flexDirection: 'row-reverse',
		justifyContent: 'flex-start'
	},
	rootSystem: {
		flexDirection: 'row',
		justifyContent: 'center'
	},
	// Slot wrappers collapse when the caller's content renders nothing, so an
	// empty Fragment or a component that returns null leaves no gap. Content is
	// never inspected to decide this.
	// Judged from this article (parent-relative), never from siblings, so the
	// global stylesheet keeps no sibling-relative :has().
	avatarOffset: {
		[chatMessageVars['--_chat-avatar-offset']]: {
			default: '0px',
			':has([data-chat-name])': spacingVars['--spacing-5']
		}
	},
	avatarWrap: {
		display: { default: null, ':empty': 'none' },
		flexShrink: 0,
		// The avatar lines up with a bubble's name row when the message holds
		// one; the article sets the offset (see chatMessageVars).
		marginBlockStart: chatMessageVars['--_chat-avatar-offset']
	},
	contentColumn: {
		display: 'flex',
		flexDirection: 'column',
		flex: 1,
		minWidth: 0
	},
	contentColumnSystem: {
		maxWidth: '90%',
		alignItems: 'center'
	},
	contentColumnAssistant: {
		alignItems: 'flex-start'
	},
	contentColumnUser: {
		alignItems: 'flex-end'
	},
	name: {
		display: { default: null, ':empty': 'none' },
		fontSize: typeScaleVars['--text-supporting-size'],
		fontWeight: fontWeightVars['--font-weight-semibold'],
		color: colorVars['--color-text-secondary'],
		lineHeight: typeScaleVars['--text-supporting-leading'],
		marginBlockEnd: spacingVars['--spacing-1']
	},
	metadata: {
		display: { default: null, ':empty': 'none' }
	},
	childrenWrap: {
		display: 'flex',
		flexDirection: 'column',
		minWidth: 0,
		width: '100%'
	},
	childrenAssistant: {
		alignItems: 'flex-start'
	},
	childrenUser: {
		alignItems: 'flex-end'
	},
	childrenSystem: {
		alignItems: 'center'
	},
	childrenGapCompact: {
		gap: spacingVars['--spacing-0-5']
	},
	childrenGapBalanced: {
		gap: spacingVars['--spacing-1']
	},
	childrenGapSpacious: {
		gap: spacingVars['--spacing-1-5']
	}
});

export function chatMessageRootAttrs(
	sender: ChatMessageSender,
	density: ChatDensity,
	hasAvatar: boolean,
	xstyle?: StyleArg
): SvelteStyleAttrs {
	const rootGap =
		density === 'compact'
			? styles.rootGapCompact
			: density === 'spacious'
				? styles.rootGapSpacious
				: styles.rootGapBalanced;
	const rootAlignment =
		sender === 'system'
			? styles.rootSystem
			: sender === 'user'
				? styles.rootUser
				: styles.rootAssistant;
	return sx(styles.avatarOffset, styles.root, rootAlignment, hasAvatar && rootGap, xstyle);
}

export function chatMessageAvatarWrapAttrs(): SvelteStyleAttrs {
	return sx(styles.avatarWrap);
}

export function chatMessageContentColumnAttrs(sender: ChatMessageSender): SvelteStyleAttrs {
	const columnAlignment =
		sender === 'system'
			? styles.contentColumnSystem
			: sender === 'user'
				? styles.contentColumnUser
				: styles.contentColumnAssistant;
	return sx(styles.contentColumn, columnAlignment);
}

export function chatMessageNameAttrs(): SvelteStyleAttrs {
	return sx(styles.name);
}

export function chatMessageMetadataAttrs(): SvelteStyleAttrs {
	return sx(styles.metadata);
}

export function chatMessageChildrenAttrs(
	sender: ChatMessageSender,
	density: ChatDensity
): SvelteStyleAttrs {
	const childrenAlignment =
		sender === 'system'
			? styles.childrenSystem
			: sender === 'user'
				? styles.childrenUser
				: styles.childrenAssistant;
	const childrenGap =
		density === 'compact'
			? styles.childrenGapCompact
			: density === 'spacious'
				? styles.childrenGapSpacious
				: styles.childrenGapBalanced;
	return sx(styles.childrenWrap, childrenAlignment, childrenGap);
}
