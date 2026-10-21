<template>
	<div class="min-h-screen bg-[#0F172A]">
		<Sidebar :isOpen="isSidebarOpen" :theme="currentTheme" />
		<div class="flex flex-col min-h-screen" :class="isSidebarOpen ? 'ml-64' : 'ml-0'" style="transition: margin-left 300ms ease-in-out;">
			<header class="h-16 px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300" :class="themeClasses.header">
				<div class="flex items-center gap-4">
					<button
						@click="isSidebarOpen = !isSidebarOpen"
						class="focus:outline-none transition-colors duration-200"
						:class="themeClasses.burgerIcon"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					<h1 class="text-xl font-semibold transition-colors duration-300" :class="themeClasses.headerText">{{ currentRouteName }}</h1>
				</div>
				<div class="flex items-center space-x-4">
					<!-- Notification Dropdown -->
					<NotificationDropdown :theme="currentTheme" />
					<!-- Theme Toggle -->
					<div class="relative" ref="dropdownThemeRef">
						<button
							@click="showThemeMenu = !showThemeMenu"
							class="flex items-center space-x-2 px-3 py-2 rounded-lg border-0 outline-none ring-0 focus:outline-none focus-visible:outline-none active:outline-none transition-all duration-200"
							:class="themeClasses.userButton"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
							</svg>
							<span class="text-sm font-medium">{{ currentTheme === 'cool' ? 'Sunny' : currentTheme === 'dark' ? 'Dark' : 'Default' }}</span>
							<Icon name="chevron-down" size="sm" :class="{ 'rotate-180': showThemeMenu }" class="transition-transform duration-200" />
						</button>

						<!-- Theme Menu Dropdown -->
						<Transition
							enter-active-class="transition ease-out duration-200"
							enter-from-class="opacity-0 scale-95 -translate-y-2"
							enter-to-class="opacity-100 scale-100 translate-y-0"
							leave-active-class="transition ease-in duration-150"
							leave-from-class="opacity-100 scale-100 translate-y-0"
							leave-to-class="opacity-0 scale-95 -translate-y-2"
						>
							<div
								v-if="showThemeMenu"
								class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-2 z-10 border origin-top-right transition-colors duration-300"
								:class="themeClasses.dropdown"
							>
								<button
									type="button"
									@click="changeTheme('default')"
									class="w-full text-left px-4 py-2 transition-all duration-200 focus:outline-none focus-visible:outline-none flex items-center justify-between"
									:class="themeClasses.dropdownItem"
								>
									<span>Default</span>
									<svg v-if="currentTheme === 'default'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
								</button>
								<div class="my-1 transition-colors duration-300" :class="'border-t ' + themeClasses.dropdownBorder"></div>
							<button
								type="button"
								@click="changeTheme('cool')"
								class="w-full text-left px-4 py-2 transition-all duration-200 focus:outline-none focus-visible:outline-none flex items-center justify-between"
								:class="themeClasses.dropdownItem"
							>
								<span>Sunny</span>
									<svg v-if="currentTheme === 'cool'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
								</button>
								<div class="my-1 transition-colors duration-300" :class="'border-t ' + themeClasses.dropdownBorder"></div>
								<button
									type="button"
									@click="changeTheme('dark')"
									class="w-full text-left px-4 py-2 transition-all duration-200 focus:outline-none focus-visible:outline-none flex items-center justify-between"
									:class="themeClasses.dropdownItem"
								>
									<span>Dark</span>
									<svg v-if="currentTheme === 'dark'" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
									</svg>
								</button>
							</div>
						</Transition>
					</div>

					<!-- User Menu -->
					<div class="relative" ref="dropdownLogoutRef">
						<button
							@click="showUserMenu = !showUserMenu"
							class="flex items-center space-x-3 border-0 outline-none ring-0 focus:outline-none focus-visible:outline-none active:outline-none transition-all duration-200"
							:class="themeClasses.userButton"
						>
							<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium transition-colors duration-300" :class="themeClasses.userAvatar">
								{{ authStore.getAliasName() }}
							</div>
							<span>{{ userAuth?.name || "Username" }}</span>
							<Icon name="chevron-down" size="sm" :class="{ 'rotate-180': showUserMenu }" class="transition-transform duration-200" />
						</button>

						<!-- User Menu Dropdown -->
						<Transition
							enter-active-class="transition ease-out duration-200"
							enter-from-class="opacity-0 scale-95 -translate-y-2"
							enter-to-class="opacity-100 scale-100 translate-y-0"
							leave-active-class="transition ease-in duration-150"
							leave-from-class="opacity-100 scale-100 translate-y-0"
							leave-to-class="opacity-0 scale-95 -translate-y-2"
						>
							<div
								v-if="showUserMenu"
								class="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-2 z-10 border origin-top-right transition-colors duration-300"
								:class="themeClasses.dropdown"
							>
								<button
									type="button"
									@click="
										showChangeResponsibilityModal = true;
										showUserMenu = false;
									"
									class="w-full text-left px-4 py-2 transition-all duration-200 focus:outline-none focus-visible:outline-none"
									:class="themeClasses.dropdownItem"
								>
									Change Akses Repo
								</button>
								<div class="my-1 transition-colors duration-300" :class="'border-t ' + themeClasses.dropdownBorder"></div>
								<button
									type="button"
									@click="handleLogout"
									class="w-full text-left px-4 py-2 transition-all duration-200 focus:outline-none focus-visible:outline-none"
									:class="themeClasses.dropdownItem"
								>
									Logout
								</button>
							</div>
						</Transition>
					</div>
				</div>
			</header>
			<main class="p-6 flex-1 transition-colors duration-300" :class="themeClasses.mainBg">
				<router-view></router-view>
			</main>
		</div>
	</div>

	<BaseModal v-model="showChangeResponsibilityModal" size="lg" :persistent="false">
		<div class="bg-white rounded-lg shadow-xl">
			<div class="px-6 py-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">Akses Responsibility</h3>
			</div>
			<div class="px-6 py-4">
				<div class="grid grid-cols-3 gap-3" v-if="authStore.listAccessResponsibility?.length > 0">
					<template v-for="responsibility in authStore.listAccessResponsibility">
						<div
							class="min-h-20 p-3 rounded-md bg-gray-200 hover:bg-green-500 hover:text-white cursor-pointer"
							:class="{
								'bg-green-500 text-white': responsibility.id === activeResponsibilityId,
							}"
							@click="activeResponsibilityId = responsibility.id"
						>
							<h2 class="font-bold text-lg mb-2">{{ responsibility.name }}</h2>
							<span class="text-sm">{{ responsibility.unit_bussiness_name }}</span>
						</div>
					</template>
				</div>
				<div class="text-center" v-else>
					<h1 class="italic">User tidak memiliki responsibility</h1>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
				<BaseButton type="button" variant="outline" color="gray" @click="showChangeResponsibilityModal = false"> Close </BaseButton>
				<BaseButton v-if="authStore.listAccessResponsibility?.length > 0" type="button" color="blue" @click="handleChooseResponsibility">
					<i class="fas fa-save me-2"></i> Save
				</BaseButton>
			</div>
		</div>
	</BaseModal>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, provide } from "vue";
import { useRouter, useRoute } from "vue-router";
import Sidebar from "@/components/Sidebar.vue";
import Icon from "@/components/Icon.vue";
import { useAuthStore } from "@/stores/useAuthStore";
import BaseModal from "@/components/BaseModal.vue";
import BaseButton from "@/components/BaseButton.vue";
import NotificationDropdown from "./NotificationDropdown.vue";

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const showUserMenu = ref(false);
const dropdownLogoutRef = ref(null);
const showChangeResponsibilityModal = ref(false);
const activeResponsibilityId = ref(localStorage.getItem("responsibility_id") || null);
const isSidebarOpen = ref(true);
const currentTheme = ref(localStorage.getItem("app_theme") || "default");
const showThemeMenu = ref(false);
const dropdownThemeRef = ref(null);

// Provide theme to child components
provide('appTheme', currentTheme);

const userAuth = computed(() => authStore.user);

const currentRouteName = computed(() => {
	if (!route.name) return "";

	return route.name
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
});

const handleLogout = () => {
	authStore.logout();
	router.push("/login");
};

const handleClickOutsideLogout = (event) => {
	if (dropdownLogoutRef.value && !dropdownLogoutRef.value.contains(event.target)) {
		showUserMenu.value = false;
	}
};

const handleClickOutsideTheme = (event) => {
	if (dropdownThemeRef.value && !dropdownThemeRef.value.contains(event.target)) {
		showThemeMenu.value = false;
	}
};

const changeTheme = (theme) => {
	currentTheme.value = theme;
	localStorage.setItem("app_theme", theme);
	showThemeMenu.value = false;
	// Set data-theme attribute on document element for global CSS targeting
	document.documentElement.setAttribute('data-theme', theme);
	document.body.className = document.body.className.replace(/theme-\w+/g, '');
	document.body.classList.add(`theme-${theme}`);
};

const themeClasses = computed(() => {
	if (currentTheme.value === "cool") {
		return {
			header: "bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200",
			headerText: "text-amber-900",
			burgerIcon: "text-amber-700 hover:text-amber-900",
			userButton: "text-amber-900 hover:text-amber-700",
			userAvatar: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md",
			dropdown: "bg-white border-amber-200",
			dropdownItem: "text-amber-900 hover:bg-amber-100",
			dropdownBorder: "border-amber-200",
			mainBg: "bg-orange-50/30",
		};
	}
	if (currentTheme.value === "dark") {
		return {
			header: "bg-[#0A0A0A] border-b border-[#1A1A1A] shadow-lg",
			headerText: "text-white",
			burgerIcon: "text-gray-400 hover:text-red-500",
			userButton: "text-gray-400 hover:text-red-400",
			userAvatar: "bg-gradient-to-br from-red-600 to-red-800 shadow-md",
			dropdown: "bg-[#141414] border-[#2A2A2A]",
			dropdownItem: "text-gray-300 hover:bg-red-600 hover:text-white",
			dropdownBorder: "border-[#2A2A2A]",
			mainBg: "bg-[#0A0A0A]",
		};
	}
	return {
		header: "bg-[#1E293B] shadow-lg",
		headerText: "text-white",
		burgerIcon: "text-gray-300 hover:text-white",
		userButton: "text-gray-300 hover:text-white",
		userAvatar: "bg-cyan-500",
		dropdown: "bg-[#1E293B] border-gray-700/50",
		dropdownItem: "text-gray-300 hover:bg-cyan-500 hover:text-white",
		dropdownBorder: "border-gray-700/50",
		mainBg: "bg-gray-50",
	};
});

const handleChooseResponsibility = async () => {
	showChangeResponsibilityModal.value = false;
	await authStore.setActiveResponsibilityId(activeResponsibilityId.value);
	if (!authStore.isActiveMenuHasPermission) {
		router.push({ path: "/dashboard" });
	}
};

watch(
	() => authStore.activeResponsibilityId,
	(val) => {
		activeResponsibilityId.value = val;
	}
);

onMounted(() => {
	document.addEventListener("click", handleClickOutsideLogout);
	document.addEventListener("click", handleClickOutsideTheme);
	// Initialize theme on document
	document.documentElement.setAttribute('data-theme', currentTheme.value);
	document.body.classList.add(`theme-${currentTheme.value}`);
});

onBeforeUnmount(() => {
	document.removeEventListener("click", handleClickOutsideLogout);
	document.removeEventListener("click", handleClickOutsideTheme);
});
</script>
