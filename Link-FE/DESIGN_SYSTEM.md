# Link — Design System & Component Prompt

## Product Vision

**Link** is a corporate messaging platform (Slack/Teams-style) enabling teams to:
- Create and manage **workspaces** with multi-level RBAC (owner/admin/member/guest)
- Organize conversations in **channels** (public/private) and **DMs**
- Exchange messages with **threads**, **reactions**, **file sharing**
- Run **video chat** for 1-on-1 and group calls
- Subscribe to **premium plans** for enhanced features

---

## Design Principles

1. **Clarity over decoration** — Information hierarchy first. Minimal chrome.
2. **Real-time responsiveness** — Typing indicators, presence, reactions feel instant.
3. **Accessibility** — WCAG 2.1 AA. Keyboard navigation throughout.
4. **Dark mode native** — Default dark theme; light mode as option.
5. **Mobile-first layout** — Adapts seamlessly from mobile to 4K desktop.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **UI Library**: Chakra UI v3 (components, theming, a11y built-in)
- **Router**: React Router v7
- **Icons**: Lucide React
- **API**: openapi-fetch + typed generated API client
- **Styling**: Emotion (via Chakra)

---

## Page & Component Map

### 1. **Auth Pages** (Public)

#### `/login` — Login Page
- Email / username input
- Password input
- "Sign up" link
- OAuth buttons (optional future)
- Error toast on failed login
- Loading spinner during submission

#### `/signup` — Signup Page
- Email input
- Username input
- Display name input
- Password input (strength meter)
- Confirm password input
- "Already have an account?" link
- Terms & privacy checkbox
- Error handling per field

---

### 2. **Main App Layout** (Protected)

#### `/` — Home (Workspace Selector or Default Workspace Feed)
- **Sidebar** (left, collapsible on mobile):
  - User profile card (avatar, name, status)
  - Workspace switcher (dropdown or modal)
  - Channel list (grouped: favorites, public, private)
  - DM list
  - Create channel button (+)
  - Create DM button (+)
  - Settings icon
  
- **Main content area**:
  - Message feed (scrollable, virtual list for 1000s of messages)
  - Message input box (rich text support)
  - File upload zone
  - Emoji picker
  
- **Right sidebar** (collapsible):
  - Thread panel (when thread open)
  - User list / presence
  - Channel/DM info card
  - Pinned messages

---

### 3. **Core Components** (Reusable)

#### **Message Bubble**
- Avatar + name + timestamp
- Message text (support @mentions, #channels, links)
- Inline images / file previews
- Reaction bar (emoji buttons, +)
- Actions menu (edit, delete, reply, pin)
- Thread badge (show reply count)

#### **Channel Header**
- Channel name / DM participant name(s)
- "Pinned" icon (count)
- Search box
- Video call button
- Info / settings menu

#### **Input Composer**
- Textarea (auto-expand, Shift+Enter for newline)
- Formatting toolbar (bold, italic, code, quote)
- File upload (click or drag)
- Emoji picker (toggle)
- @ mention autocomplete
- # channel autocomplete
- Send button (keyboard: Cmd/Ctrl+Enter)

#### **Message Actions Menu**
- Edit
- Delete
- Reply / Reply in thread
- Pin
- React
- Copy link
- Mark as unread

#### **Reaction Picker**
- Grid of 50+ common emojis
- Search box
- Recently used
- "Add reaction" button

#### **User Card** (Hover / Click)
- Avatar
- Display name
- Status (online / idle / offline / do-not-disturb)
- Role badge (owner / admin / member / guest)
- Message / Call buttons
- View profile link

---

### 4. **Modals & Popovers**

#### **Create / Edit Channel Modal**
- Channel name input
- Channel type (public / private)
- Description textarea
- Topic / hashtag input
- "Create" or "Save" button
- Cancel

#### **Create DM Modal**
- User search input (typeahead)
- Selected users list (removable chips)
- "Start conversation" button

#### **User Settings Modal**
- Profile tab
  - Avatar upload
  - Display name edit
  - Email display (read-only)
  - Status selector (online / idle / dnd / offline)
  
- Notifications tab
  - Toggle: push notifications, sound, desktop alerts
  - Mute channels / users
  
- Appearance tab
  - Dark / light mode toggle
  - Font size slider
  - Theme color picker
  
- Security tab
  - Change password
  - Active sessions
  - Sign out all devices

#### **Workspace Settings Modal** (Admin only)
- Workspace name
- Icon / avatar
- Member list (with role + remove buttons)
- Invite link (copy button)
- Leave / delete workspace

---

### 5. **Loading & Empty States**

#### **Message List Loading**
- Skeleton cards (3–5 repeated, with animation)

#### **Empty Channel**
- Large icon
- "No messages yet. Start the conversation!"
- Suggested actions

#### **Offline State**
- Banner at top: "You're offline. Messages will sync when back online."
- Spinner + retry button

---

## Color Palette (Chakra Tokens)

```
Background:     bg.canvas (dark: #0F0F0F, light: #FFFFFF)
Primary accent: blue.500 (#3B82F6)
Success:        green.500 (#10B981)
Warning:        yellow.500 (#F59E0B)
Error:          red.500 (#EF4444)
Text primary:   gray.900 (dark: gray.50)
Text secondary: gray.500
Border:         gray.200 (dark: gray.700)
```

---

## Responsive Breakpoints (Chakra)

```
base:  < 640px  (mobile)
sm:    640px    (small tablet)
md:    768px    (tablet)
lg:    1024px   (desktop)
xl:    1280px   (wide)
2xl:   1536px   (ultrawide)
```

**Layout rules**:
- **Mobile**: Single-column. Sidebar becomes bottom nav or slide-in drawer. No right sidebar.
- **Tablet**: Two-column (sidebar + content). Right sidebar hidden by default.
- **Desktop**: Three-column (sidebar + content + details).

---

## Interaction Patterns

### **Typing Indicator**
- "John is typing..." appears above input
- Fades out when typing stops
- Comma-separated names if 2+ users typing

### **Presence Indicator**
- Dot color in avatar: green (online) / yellow (idle) / gray (offline)
- Last seen timestamp on hover

### **Real-time Reactions**
- Emoji appears instantly when clicked
- Count increments in real time
- Click again to remove your reaction

### **Threads**
- Click "reply" → thread panel opens on right (desktop) or fullscreen (mobile)
- Thread shows original message + replies in chronological order
- Badge on message shows reply count, clickable to open thread

### **File Upload**
- Drag-drop zone in input area
- Click to browse
- Preview thumbnail before send
- Progress bar during upload
- Clickable preview in message (inline image or download link)

---

## Accessibility (A11A)

- All buttons labeled (`aria-label`)
- Form inputs with `<label>` elements
- Icons paired with text or `aria-label`
- Color contrast ≥ 4.5:1 for text
- Focus visible (outline or ring)
- Keyboard nav: Tab → shift+Tab ← Arrow keys for lists
- Screen reader announcements for new messages (live region)
- Modal traps focus and restores on close

---

## Future Enhancements

- **Video call UI**: Peer video grid, screen share, reactions
- **File sharing**: Drag-drop, inline previews, download tracking
- **Search**: Full-text search across messages, with filters
- **Notifications**: In-app badges, desktop alerts, email digests
- **Premium UI**: Upgrade prompts, feature gates, billing portal
- **Mobile app**: React Native version sharing API + core logic

---

## File Structure for Components

```
src/
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   ├── layout/
│   │   ├── AppLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── message/
│   │   ├── MessageBubble.tsx
│   │   ├── InputComposer.tsx
│   │   └── ReactionPicker.tsx
│   ├── channel/
│   │   ├── ChannelHeader.tsx
│   │   └── ChannelList.tsx
│   ├── user/
│   │   ├── UserCard.tsx
│   │   └── UserList.tsx
│   └── modals/
│       ├── CreateChannelModal.tsx
│       └── UserSettingsModal.tsx
├── feature/
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── ChannelPage.tsx
│   └── DMPage.tsx
└── lib/
    ├── api.ts          (typed fetch client)
    └── hooks.ts        (useAuth, useMessages, etc.)
```

---

## How to Use This Document

1. **For designers**: Use this as the spec for mockups and design tokens.
2. **For developers**: Implement components in order (modals → input → messages → layout).
3. **For reviews**: Check against these principles — any deviation should be intentional and documented.
4. **To extend**: Add new sections under "Page & Component Map" as features ship.

