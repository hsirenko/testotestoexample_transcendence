// nav.ts – navbar, overlays, tabs, play-flow
import { initHistoryTab } from './history.js';
import { initRemoteModal } from './main.js';
import { WS_BASE } from './config.js';
import { pushHome } from './nav_history.js';
import { populateProfileViews, refreshProfileHeader, setActiveTab } from './profile-setting.js';
import { initStatsTab } from './stats.js';
import { hideOverlay, initTournamentModal, showOverlay } from './tournament.js';
import './welcome.js';

//get the html elements
const profileOv = document.getElementById('profile-overlay')!;
const profileBox = document.getElementById('profile-container')!;

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);

//hamburger menu for mobile objects
const navMenu = $('#nav-menu');
const BURGER = $('#burger');
const MOBILE_BP = 640;
const DROP = [
    'flex',
    'flex-col',
    'absolute',
    'left-0',
    'right-0',
    'top-16',
    'w-screen',
    'space-y-4',
    'items-center',
    'py-4',
    'bg-violet-950/95',
] as const;

function applyMobile(on: boolean) {
    if (!navMenu) return;
    DROP.forEach((c) => navMenu.classList[on ? 'add' : 'remove'](c));
}
function openMenu() {
    if (navMenu) {
        navMenu.classList.remove('hidden');
        applyMobile(true);
    }
}
function closeMenu() {
    if (navMenu) {
        applyMobile(false);
        navMenu.classList.add('hidden');
    }
}

BURGER?.addEventListener('click', () =>
    navMenu && navMenu.classList.contains('hidden') ? openMenu() : closeMenu()
);
navMenu
    ?.querySelectorAll('button')
    .forEach((btn) => btn.addEventListener('click', () => innerWidth < MOBILE_BP && closeMenu()));
addEventListener('resize', () => {
    if (!navMenu) return;
    if (innerWidth >= MOBILE_BP) {
        navMenu.classList.remove('hidden');
        applyMobile(false);
    } else if (navMenu.classList.contains('hidden')) applyMobile(false);
    else applyMobile(true);
});

function flashAvatarWarn(text: string): void {
    let n = document.getElementById('avatar-warn') as HTMLDivElement | null;
    if (!n) {
        n = document.createElement('div');
        n.id = 'avatar-warn';
        n.className =
            'fixed top-6 left-1/2 -translate-x-1/2 z-[80] ' +
            'px-4 py-2 rounded-full text-sm font-medium ' +
            'bg-emerald-500/90 text-white shadow-lg ' + // ← here
            'opacity-0 pointer-events-none transition-opacity duration-300';
        document.body.appendChild(n);
    }
    n.textContent = text;
    n.classList.remove('opacity-0');
    setTimeout(() => n!.classList.add('opacity-0'), 2_000);
}

const avatarInput = document.getElementById('avatar-input') as HTMLInputElement | null;
const avatarImg = document.getElementById('avatar-img') as HTMLImageElement | null;

const removeBtn = document.getElementById('avatar-remove-btn') as HTMLButtonElement | null;

if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
        const FALLBACK =
            'https://img.freepik.com/free-vector/' +
            'cute-astronaut-playing-vr-game-with-controller-cartoon-vector-icon-' +
            'illustration-science-technology_138676-13977.jpg?semt=ais_hybrid&w=740';
        if (avatarImg) avatarImg.src = FALLBACK;
        if (avatarInput) avatarInput.value = '';

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/avatar`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
            console.error('Avatar delete failed');
            return;
        }

        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        user.avatar_url = null;
        localStorage.setItem('user', JSON.stringify(user));
        flashAvatarWarn('Avatar removed 👌');
    });
}

if (avatarInput) {
    avatarInput.addEventListener('change', async (ev) => {
        const file = (ev.currentTarget as HTMLInputElement).files?.[0];
        if (!file) return;
        if (avatarImg) avatarImg.src = URL.createObjectURL(file);
        const fd = new FormData();
        fd.append('avatar', file);

        const token = localStorage.getItem('token');
        const res = await fetch(`/api/users/avatar`, {
            method: 'PUT',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
        });

        if (!res.ok) {
            console.error('Avatar upload failed');
            return;
        }

        const { avatar_url } = await res.json();
        const fullUrl = `/uploads/${avatar_url}`;

        if (avatarImg) avatarImg.src = fullUrl;

        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        user.avatar_url = avatar_url;
        localStorage.setItem('user', JSON.stringify(user));
        flashAvatarWarn('Avatar updated 👍');
    });
}

/* tabs */
const tabBtns = document.querySelectorAll<HTMLButtonElement>('#profile-tabs .tab-btn');
const panels = document.querySelectorAll<HTMLElement>('#tab-panels .panel');
const underline = $('#tab-underline')!;

function updateUnderline(): void {
    const active = document.querySelector<HTMLButtonElement>('#profile-tabs .tab-btn.text-white');
    if (active) {
        underline.style.width = `${active.offsetWidth}px`;
        underline.style.transform = `translateX(${active.offsetLeft}px)`;
    }
}

tabBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
        tabBtns.forEach((b) => {
            b.classList.toggle('text-white', b === btn);
            b.classList.toggle('text-white/70', b !== btn);
        });
        underline.style.width = `${btn.offsetWidth}px`;
        underline.style.transform = `translateX(${btn.offsetLeft}px)`;
        panels.forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.tab));
        if (btn.dataset.tab === 'stats') initStatsTab();
        if (btn.dataset.tab === 'history') initHistoryTab();
    })
);
addEventListener('resize', updateUnderline);

$('#nav-profile')?.addEventListener('click', () => {
    populateProfileViews();
    setActiveTab('info');
    showOverlay(profileOv, profileBox);
    updateUnderline();
    refreshProfileHeader();
});

document.getElementById('profile-close')?.addEventListener('click', () => {
    hideOverlay(profileOv, profileBox); // fade/scale-out
    pushHome(); // history: back to home
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !profileOv.classList.contains('hidden')) {
        hideOverlay(profileOv, profileBox);
        pushHome();
    }
});

//function used to show overlay
function show(ov: HTMLElement, inner?: HTMLElement) {
    ov.classList.remove(
        'hidden',
        'opacity-0',
        'animate__fadeOut',
        'animate__animated',
        'animate__fadeIn'
    );

    if (inner) inner.classList.remove('scale-90');

    ov.style.transition = 'none';
    ov.classList.add('opacity-100');
    ov.offsetHeight;
    ov.style.removeProperty('transition');
}

function hide(ov: HTMLElement, inner?: HTMLElement) {
    if (ov.classList.contains('hidden')) return;
    ov.classList.remove('animate__fadeIn');
    ov.classList.add('animate__fadeOut');
    if (inner) inner.classList.add('scale-90');
    ov.addEventListener(
        'animationend',
        () => {
            ov.classList.add('hidden', 'opacity-0');
            ov.classList.remove('animate__animated', 'animate__fadeOut');
        },
        { once: true }
    );
}

const playOv = document.getElementById('play-overlay')!;
const playBox = document.getElementById('play-container')!;

$('#nav-play')?.addEventListener('click', () => show(playOv));

/* CLOSE via × button */
document.getElementById('play-close')?.addEventListener('click', () => {
    hideOverlay(playOv, playBox);
    pushHome();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !playOv.classList.contains('hidden')) {
        hideOverlay(playOv, playBox);
        pushHome();
    }
});

document.querySelectorAll<HTMLButtonElement>('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
        const mode = card.dataset.mode as 'ai' | 'offline' | 'remote' | 'tournament';
        hide(playOv);
        if (mode === 'ai') {
            show($('#difficulty-overlay')!, $('#difficulty-container')!);
        } else if (mode === 'offline') {
            (window as any).setGameMode('pvp');
        } else if (mode === 'remote') {
            initRemoteModal();
        } else {
            initTournamentModal();
        }
    });
});

const diffOv = $('#difficulty-overlay')!;
const diffBox = $('#difficulty-container')!;
$('#difficulty-close')?.addEventListener('click', () => hide(diffOv, diffBox));
addEventListener('keydown', (e) => e.key === 'Escape' && hide(diffOv, diffBox));
document.querySelectorAll<HTMLButtonElement>('.diff-btn').forEach((btn) =>
    btn.addEventListener('click', () => {
        const diff = btn.dataset.diff as 'easy' | 'medium' | 'hard';
        hide(diffOv, diffBox);
        const rate = diff === 'easy' ? 1.5 : diff === 'medium' ? 1 : 0.5;
        (window as any).setAIRefresh(rate);
        (window as any).setGameMode('ai');
    })
);

//TWO FACTOR AUTHENTICATION, FOR MUHAISEN BY JNDE
document.getElementById('remove-2fa-btn')?.addEventListener('click', () => {
    (document.getElementById('remove-2fa-modal') as HTMLElement).classList.remove('hidden');
    (document.getElementById('remove-2fa-token-input') as HTMLInputElement).value = '';
    (document.getElementById('remove-2fa-error') as HTMLElement).textContent = '';
});

document.getElementById('remove-2fa-cancel-btn')?.addEventListener('click', () => {
    (document.getElementById('remove-2fa-modal') as HTMLElement).classList.add('hidden');
});

document.getElementById('remove-2fa-confirm-btn')?.addEventListener('click', async () => {
    const token = (document.getElementById('remove-2fa-token-input') as HTMLInputElement).value;
    const errorEl = document.getElementById('remove-2fa-error')!;
    const tokenStorage = localStorage.getItem('token');

    try {
        const res = await fetch(`/api/2fa/remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenStorage}`,
            },
            body: JSON.stringify({ token }),
        });

        const result = await res.json();
        if (!res.ok) {
            errorEl.textContent = result.error || 'Something went wrong.';
            return;
        }

        (document.getElementById('remove-2fa-modal') as HTMLElement).classList.add('hidden');
        refreshProfileHeader();
    } catch (err) {
        errorEl.textContent = 'Network error';
    }
});
