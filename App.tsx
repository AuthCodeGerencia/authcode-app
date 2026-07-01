import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ConvexProvider, useAction, useMutation, useQuery } from "convex/react";
import { ConvexReactClient } from "convex/react";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginLogo from "./assets/login-logo.svg";
import { api } from "./convex/_generated/api";
import type { Id } from "./convex/_generated/dataModel";

const SESSION_KEY = "authcode.mobile.session";
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type SessionUser = {
  id: Id<"profile">;
  name: string;
  email: string;
  role: string;
  empresa?: Id<"empresas">;
};

type Project = {
  id: Id<"proyectos">;
  name: string;
  icon: string | null;
  iconUrl?: string | null;
  iconoUrl?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  company: string;
  phase: string;
  dueDate: string;
  status: string;
  percent: number;
  band: "critical" | "risk" | "steady" | "healthy";
  tasks: { total: number; pending: number; overdue: number; dueSoon: number };
  url: string | null;
  isFavorite?: boolean;
};

type ProjectTab = "todos" | "favoritos" | string;
type DashboardTab = "proyectos" | "tickets" | "horas";
type ProjectSectionTab = "tareas" | "etapas" | "equipo" | "tickets" | "avances";
type TaskFormDropdown = "status" | "priority" | "phase" | "owners" | null;
type ProjectCreateTab = "info" | "equipo" | "fases" | "archivos";
type ProjectCreateDropdown = "company" | "template" | "phase" | "lifecycle" | null;
type ProjectLifecycle = "activo" | "inactivo";

type TaskStatus =
  | "idea"
  | "pendiente"
  | "prioridad"
  | "proceso"
  | "qa"
  | "produccion"
  | "completada";

type TaskPriority = "alta" | "media" | "baja";

type Task = {
  id: Id<"tareas">;
  title: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  phaseName: string;
  dueDate: string;
  owners: Array<{ id: Id<"profile">; name: string }>;
  isDone: boolean;
  isOverdue: boolean;
};

type ProjectMember = {
  id: Id<"profile">;
  name: string;
  email: string;
  role: string;
};

type ProjectPhase = {
  index: number;
  name: string;
};

type ProjectPhaseDraft = {
  name: string;
  dueDate: string;
  completed: boolean;
};

type ProjectCreateOptions = {
  canCreate: boolean;
  companies: Array<{ id: Id<"empresas">; name: string }>;
  people: Array<{
    id: Id<"profile">;
    name: string;
    email: string;
    role: string;
    companyId: Id<"empresas"> | null;
  }>;
  templates: Array<{
    id: Id<"plantillasFasesProyecto">;
    name: string;
    phases: Array<{ name: string; dueDate: string }>;
  }>;
  defaultPhases: Array<{ nombre: string; fechaEstimada: string }>;
};

type ProfileDetail = {
  id?: Id<"profile">;
  _id?: Id<"profile">;
  proyectos_favoritos?: Id<"proyectos">[];
};

type PickedAttachment = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

type TaskAttachment = {
  id?: Id<"_storage">;
  storageId?: Id<"_storage">;
  name: string;
  url?: string | null;
};

type NotificationItem = {
  id: Id<"notificaciones">;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdLabel: string;
  projectId: Id<"proyectos"> | null;
  projectName: string | null;
  taskId: Id<"tareas"> | null;
};

type PushDestination = {
  notificationId?: Id<"notificaciones">;
  projectId?: Id<"proyectos">;
  taskId?: Id<"tareas">;
};

type TaskDetail = {
  id: Id<"tareas">;
  title: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  priority: TaskPriority | null;
  tag: string | null;
  phaseIndex?: number | null;
  dueDate: string;
  phaseName: string;
  project: {
    id: Id<"proyectos">;
    name: string;
    company: string;
  };
  owners: Array<{ id: Id<"profile">; name: string; email: string }>;
  attachments: TaskAttachment[];
  comments: Array<{
    id: Id<"comentariosTareas">;
    content: string;
    authorName: string;
    createdLabel: string;
    attachmentNames: string[];
  }>;
};

type ProjectDetail = {
  phases: Array<{ index: number; name: string; dueDate: string; completed: boolean; active: boolean }>;
  members: ProjectMember[];
  tickets: Array<{ id: Id<"tickets">; title: string; status: string; priority: string; createdLabel: string }>;
  avances: Array<{ id: Id<"avances">; name: string; description: string; status: string; phaseIndex: number | null }>;
  documentsCount: number;
  notes: string;
  lifecycle: string;
};

type TicketItem = {
  id: Id<"tickets">;
  title: string;
  description: string;
  status: "abierto" | "en_proceso" | "cerrado" | string;
  priority: string;
  type: string;
  projectId: Id<"proyectos"> | null;
  projectName: string;
  assignedTo: string;
  createdLabel: string;
  historyCount: number;
};

type WorkSummary = {
  activeTimer: null | {
    taskId: Id<"tareas">;
    projectId: Id<"proyectos"> | null;
    taskTitle: string;
    projectName: string;
    mode: "running" | "paused";
    workedMs: number;
    workedLabel: string;
  };
  pausedTimers: Array<{
    taskId: Id<"tareas">;
    taskTitle: string;
    projectName: string;
    workedMs: number;
    workedLabel: string;
  }>;
  logs: Array<{
    id: Id<"time_work_logs">;
    taskTitle: string;
    projectName: string;
    startedLabel: string;
    durationMs: number;
    durationLabel: string;
  }>;
  todayMs: number;
  todayLabel: string;
};

const PROJECT_ICON_URL_FALLBACKS: Record<string, string> = {
  j9785vast0syap1q3m183nmyt980pr20:
    "https://unique-parakeet-602.convex.cloud/api/storage/a8e6a50d-60de-4212-9fee-b21285e894d1",
  j97cbcfhrps7s4qa4rz1p4nrpx852nxy:
    "https://unique-parakeet-602.convex.cloud/api/storage/88dc77d0-068f-474b-bbf0-1cc21588778b",
  j97c848gxwaza6chfmxbq1qkmd8535ve:
    "https://unique-parakeet-602.convex.cloud/api/storage/149c095c-c6ad-4015-a3b6-e819294fd8d6",
  j977bhnn2f7wwwbzs7zmwxvd0n852464:
    "https://unique-parakeet-602.convex.cloud/api/storage/c182d624-3436-41c7-938a-dec1e30a52e4",
  j9777xkp4byafy67dtk74qye7h859nj7:
    "https://unique-parakeet-602.convex.cloud/api/storage/800033f1-0047-4fd4-8533-a153dac64f41",
  j976rqxyy7qx1w4z40fksq172n85br6w:
    "https://unique-parakeet-602.convex.cloud/api/storage/543abc63-c10b-4ae2-983b-c9458be16229",
  j97bfjh90egm5wr15hsear5xex882k1w:
    "https://unique-parakeet-602.convex.cloud/api/storage/b3d94eb7-c7a5-4e38-a389-ea79698973e8",
  j972ks7qtky0e1bbrpjby847fn89aq1w:
    "https://unique-parakeet-602.convex.cloud/api/storage/633a3f8b-459f-4bb9-8567-38d63155a818",
};

const PROJECT_ICON_OPTIONS = [
  "📁",
  "🚀",
  "🌐",
  "📱",
  "🛒",
  "🎨",
  "⚙️",
  "📊",
  "🏢",
  "💡",
  "🔧",
  "📦",
  "🍕",
  "🏗️",
  "🎯",
  "🧩",
  "💳",
  "📣",
  "🧪",
  "🗂️",
];

const DEFAULT_PROJECT_PHASES: ProjectPhaseDraft[] = [
  { name: "Diseño", dueDate: "", completed: false },
  { name: "Aprobación", dueDate: "", completed: false },
  { name: "Cambios de diseño", dueDate: "", completed: false },
  { name: "Desarrollo", dueDate: "", completed: false },
  { name: "Aprobado en desarrollo", dueDate: "", completed: false },
  { name: "Deploy", dueDate: "", completed: false },
];

const PROJECT_LIFECYCLE_OPTIONS: Array<{ key: ProjectLifecycle; label: string }> = [
  { key: "activo", label: "Activo" },
  { key: "inactivo", label: "Inactivo" },
];

const TASK_STATUS_OPTIONS: Array<{ key: TaskStatus; label: string }> = [
  { key: "idea", label: "Idea" },
  { key: "pendiente", label: "Pendiente" },
  { key: "prioridad", label: "Prioridad" },
  { key: "proceso", label: "Proceso" },
  { key: "qa", label: "QA" },
  { key: "produccion", label: "Producción" },
  { key: "completada", label: "Completada" },
];

const PRIORITY_OPTIONS: Array<{ key: TaskPriority; label: string }> = [
  { key: "alta", label: "Alta" },
  { key: "media", label: "Media" },
  { key: "baja", label: "Baja" },
];

const TICKET_STATUS_OPTIONS = [
  { key: "abierto", label: "Abierto" },
  { key: "en_proceso", label: "En proceso" },
  { key: "cerrado", label: "Cerrado" },
] as const;

const TICKET_PRIORITY_OPTIONS = [
  { key: "low", label: "Baja" },
  { key: "medium", label: "Media" },
  { key: "high", label: "Alta" },
  { key: "urgent", label: "Urgente" },
] as const;

async function pickAttachments() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    mimeType: asset.mimeType,
    name: asset.name,
    size: asset.size,
    uri: asset.uri,
  }));
}

async function pickImageAttachment() {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: "image/*",
  });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  return {
    mimeType: asset.mimeType,
    name: asset.name,
    size: asset.size,
    uri: asset.uri,
  };
}

async function uploadPickedAttachments(
  attachments: PickedAttachment[],
  createUploadUrl: () => Promise<string>,
) {
  const storageIds: Id<"_storage">[] = [];
  const names: string[] = [];

  for (const attachment of attachments) {
    const uploadUrl = await createUploadUrl();
    const fileResponse = await fetch(attachment.uri);
    const blob = await fileResponse.blob();
    const uploadResponse = await fetch(uploadUrl, {
      body: blob,
      headers: {
        "Content-Type": attachment.mimeType ?? "application/octet-stream",
      },
      method: "POST",
    });

    if (!uploadResponse.ok) {
      throw new Error(`No se pudo subir ${attachment.name}.`);
    }

    const upload = (await uploadResponse.json()) as { storageId: Id<"_storage"> };
    storageIds.push(upload.storageId);
    names.push(attachment.name);
  }

  return { names, storageIds };
}

function createdTaskIdFromResult(result: unknown) {
  if (typeof result === "string") return result as Id<"tareas">;
  if (result && typeof result === "object") {
    const task = result as {
      _id?: Id<"tareas">;
      id?: Id<"tareas">;
      taskId?: Id<"tareas">;
      tareaId?: Id<"tareas">;
    };
    return task.taskId ?? task.tareaId ?? task.id ?? task._id ?? null;
  }
  return null;
}

async function getPushRegistrationTokens() {
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      importance: Notifications.AndroidImportance.MAX,
      name: "General",
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const currentPermissions = await Notifications.getPermissionsAsync();
  const finalPermissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync();

  if (!finalPermissions.granted) return null;

  const nativeToken = await Notifications.getDevicePushTokenAsync().catch(() => null);
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const expoToken = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => null)
    : null;

  if (!nativeToken?.data && !expoToken?.data) return null;

  return {
    expoToken: expoToken?.data ?? null,
    nativeToken: nativeToken?.data ?? null,
    nativeTokenType: nativeToken?.type ?? null,
    platform: Platform.OS,
  };
}

function stringFromNotificationData(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function destinationFromNotificationResponse(
  response: Notifications.NotificationResponse | null,
): PushDestination | null {
  const data = response?.notification.request.content.data;
  if (!data) return null;

  const projectId = stringFromNotificationData(data.projectId ?? data.project_id);
  const taskId = stringFromNotificationData(data.taskId ?? data.task_id);
  const notificationId = stringFromNotificationData(data.notificationId ?? data.notification_id);

  if (!projectId && !notificationId) return null;

  return {
    notificationId: notificationId as Id<"notificaciones"> | undefined,
    projectId: projectId as Id<"proyectos"> | undefined,
    taskId: taskId as Id<"tareas"> | undefined,
  };
}

function formatFileSize(size?: number) {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function taskAttachmentId(attachment: TaskAttachment) {
  return attachment.id ?? attachment.storageId ?? null;
}

function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as { user?: SessionUser };
        if (parsed.user?.id) setUser(parsed.user);
      })
      .catch(() => AsyncStorage.removeItem(SESSION_KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (nextUser: SessionUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ user: nextUser }));
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  return { user, loading, login, logout };
}

function LoginScreen({
  authClient,
  onLogin,
}: {
  authClient: ConvexReactClient;
  onLogin: (user: SessionUser) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    if (!email.trim() || !password) {
      Alert.alert("Faltan datos", "Ingresa correo y contraseña.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.query(api.users.verifyCredentials, {
        email: email.trim(),
        password,
      });

      if (!result.valid || !result.user) {
        Alert.alert("No se pudo iniciar sesión", "Verifica tus credenciales.");
        return;
      }

      await onLogin({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        empresa: result.user.empresa,
      });
    } catch (error) {
      Alert.alert(
        "Error de conexión",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [authClient, email, onLogin, password]);

  return (
    <LinearGradient colors={["#111", "#211f18", "#f6de39"]} style={styles.loginRoot}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.loginContent}
      >
        <View style={styles.loginCard}>
          <LoginLogo width={170} height={44} />
          <View>
            <Text style={styles.eyebrow}>Portal de proyectos</Text>
            <Text style={styles.loginTitle}>Bienvenido de nuevo.</Text>
            <Text style={styles.loginSubtitle}>
              Usa tus credenciales de Authcode Tickets para entrar.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico</Text>
            <View style={styles.inputShell}>
              <Ionicons name="mail-outline" size={19} color="#7a8088" />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="nombre@authcode.com"
                placeholderTextColor="#9aa0a8"
                style={styles.input}
                value={email}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={19} color="#7a8088" />
              <TextInput
                autoCapitalize="none"
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#9aa0a8"
                secureTextEntry={!showPassword}
                style={styles.input}
                value={password}
              />
              <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.iconButton}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} />
              </Pressable>
            </View>
          </View>

          <Pressable
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [styles.primaryButton, (pressed || submitting) && styles.pressed]}
          >
            {submitting ? (
              <ActivityIndicator color="#111" />
            ) : (
              <>
                <Text style={styles.primaryText}>Entrar</Text>
                <Ionicons name="arrow-forward" size={20} color="#111" />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Dashboard({ user, onLogout }: { user: SessionUser; onLogout: () => Promise<void> }) {
  const result = useQuery(api.mobile.getProjectsOverview, { profileId: user.id });
  const profileResult = useQuery(api.profile.getProfileById, { id: user.id }) as
    | ProfileDetail
    | undefined;
  const notificationsResult = useQuery(api.mobile.getNotifications, {
    profileId: user.id,
    limit: 40,
  });
  const ticketsResult = useQuery((api as any).mobile.getTicketsOverview, {
    profileId: user.id,
    limit: 80,
  }) as { tickets: TicketItem[] } | undefined;
  const workResult = useQuery((api as any).mobile.getWorkSummary, {
    profileId: user.id,
    limit: 25,
  }) as WorkSummary | undefined;
  const markNotificationRead = useMutation(api.mobile.markNotificationRead);
  const registerPushToken = useMutation((api as any).mobile.registerPushToken);
  const sendTestPush = useAction((api as any).pushNotifications.testForProfile);
  const projects = (result?.projects ?? []) as Project[];
  const favoriteProjectIds = useMemo(
    () => new Set(profileResult?.proyectos_favoritos ?? []),
    [profileResult?.proyectos_favoritos],
  );
  const projectsWithFavorites = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        isFavorite: project.isFavorite ?? favoriteProjectIds.has(project.id),
      })),
    [favoriteProjectIds, projects],
  );
  const loading = result === undefined;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProjectTab>("favoritos");
  const [mainTab, setMainTab] = useState<DashboardTab>("proyectos");
  const [selectedProject, setSelectedProject] = useState<{
    project: Project;
    taskId?: Id<"tareas">;
  } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pendingPushDestination, setPendingPushDestination] = useState<PushDestination | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPushRegistrationTokens()
      .then(async (tokens) => {
        if (cancelled || !tokens) return;
        await registerPushToken({
          expoToken: tokens.expoToken ?? undefined,
          nativeToken: tokens.nativeToken ?? undefined,
          nativeTokenType: tokens.nativeTokenType ?? undefined,
          platform: tokens.platform,
          profileId: user.id,
        });
      })
      .catch((error) => {
        console.warn("[push] No se pudo registrar el dispositivo", error);
      });

    return () => {
      cancelled = true;
    };
  }, [registerPushToken, user.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const destination = destinationFromNotificationResponse(response);
        if (destination) setPendingPushDestination(destination);
      })
      .catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const destination = destinationFromNotificationResponse(response);
      if (destination) setPendingPushDestination(destination);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingPushDestination) return;

    const project = projectsWithFavorites.find(
      (item) => item.id === pendingPushDestination.projectId,
    );
    if (!project) return;

    setSelectedProject({
      project,
      taskId: pendingPushDestination.taskId,
    });

    if (pendingPushDestination.notificationId) {
      markNotificationRead({
        profileId: user.id,
        notificationId: pendingPushDestination.notificationId,
      }).catch(() => {});
    }

    setPendingPushDestination(null);
  }, [markNotificationRead, pendingPushDestination, projectsWithFavorites, user.id]);

  const testPush = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("No disponible", "Las push notifications solo se prueban en iOS o Android.");
      return;
    }

    setTestingPush(true);
    try {
      const tokens = await getPushRegistrationTokens();
      if (!tokens) {
        Alert.alert("Permiso requerido", "Activa las notificaciones para este dispositivo.");
        return;
      }

      await registerPushToken({
        expoToken: tokens.expoToken ?? undefined,
        nativeToken: tokens.nativeToken ?? undefined,
        nativeTokenType: tokens.nativeTokenType ?? undefined,
        platform: tokens.platform,
        profileId: user.id,
      });

      const result = await sendTestPush({ profileId: user.id });
      Alert.alert(
        "Prueba de push",
        `Intentos: ${result?.attempted ?? 0}\nEnviados: ${result?.sent ?? 0}\nDesactivados: ${result?.disabled ?? 0}`,
      );
    } catch (error) {
      Alert.alert(
        "No se pudo probar",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setTestingPush(false);
    }
  }, [registerPushToken, sendTestPush, user.id]);

  const sortedProjects = useMemo(
    () =>
      [...projectsWithFavorites].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [projectsWithFavorites],
  );

  const projectTabs = useMemo(() => {
    const phases = [...new Set(sortedProjects.map((project) => project.phase))];
    return [
      {
        key: "favoritos" as ProjectTab,
        label: "Favoritos",
        count: sortedProjects.filter((project) => project.isFavorite).length,
      },
      { key: "todos" as ProjectTab, label: "Todos", count: sortedProjects.length },
      ...phases.map((phase) => ({
        key: phase,
        label: phase,
        count: sortedProjects.filter((project) => project.phase === phase).length,
      })),
    ];
  }, [sortedProjects]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedProjects.filter((project) => {
      const byTab =
        tab === "todos" || (tab === "favoritos" ? project.isFavorite : project.phase === tab);
      const bySearch =
        term.length === 0 ||
        project.name.toLowerCase().includes(term) ||
        project.company.toLowerCase().includes(term) ||
        project.phase.toLowerCase().includes(term);
      return byTab && bySearch;
    });
  }, [search, sortedProjects, tab]);

  const stats = useMemo(
    () => ({
      total: projectsWithFavorites.length,
      risk: projectsWithFavorites.filter((p) => p.band === "risk").length,
      critical: projectsWithFavorites.filter((p) => p.band === "critical").length,
      done: projectsWithFavorites.filter((p) => p.percent >= 100).length,
    }),
    [projectsWithFavorites],
  );
  const dashboardTabs = [
    { key: "proyectos" as const, label: "Proyectos", count: projectsWithFavorites.length },
    { key: "tickets" as const, label: "Tickets", count: ticketsResult?.tickets.length ?? 0 },
    { key: "horas" as const, label: "Horas", count: workResult?.logs.length ?? 0 },
  ];

  if (selectedProject) {
    return (
        <TasksScreen
          onProjectRenamed={(name) =>
            setSelectedProject((current) =>
              current
                ? { ...current, project: { ...current.project, name } }
                : current,
            )
          }
          onBack={() => setSelectedProject(null)}
          initialTaskId={selectedProject.taskId}
          project={selectedProject.project}
        user={user}
      />
    );
  }

  return (
    <SafeAreaView style={styles.dashboard}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboardContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hola, {user.name.split(" ")[0]}</Text>
            <Text style={styles.subhead}>Proyectos y estatus</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              disabled={testingPush}
              onPress={testPush}
              style={[styles.logout, testingPush && styles.pressed]}
            >
              {testingPush ? (
                <ActivityIndicator color="#111" size="small" />
              ) : (
                <Ionicons name="paper-plane-outline" size={21} color="#111" />
              )}
            </Pressable>
            <Pressable onPress={() => setNotificationsOpen(true)} style={styles.logout}>
              <Ionicons name="notifications-outline" size={22} color="#111" />
              {(notificationsResult?.unreadCount ?? 0) > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {Math.min(notificationsResult?.unreadCount ?? 0, 99)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={onLogout} style={styles.logout}>
              <Ionicons name="log-out-outline" size={22} color="#111" />
            </Pressable>
          </View>
        </View>

        <View style={styles.summary}>
          <Summary label="Proyectos" value={stats.total} />
          <Summary label="En riesgo" value={stats.risk} />
          <Summary label="Atrasados" value={stats.critical} />
          <Summary label="Listos" value={stats.done} />
        </View>

        <View style={styles.segmented}>
          {dashboardTabs.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setMainTab(item.key)}
              style={[styles.segmentButton, mainTab === item.key && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, mainTab === item.key && styles.segmentTextActive]}>
                {item.label}
              </Text>
              <Text style={[styles.segmentCount, mainTab === item.key && styles.segmentTextActive]}>
                {item.count}
              </Text>
            </Pressable>
          ))}
        </View>

        {mainTab === "proyectos" ? (
          <>
            <View style={styles.projectToolbar}>
              <Text style={styles.sectionTitle}>Proyectos</Text>
              <Pressable
                onPress={() => setCreateProjectOpen(true)}
                style={styles.smallActionButton}
              >
                <Ionicons name="add" size={18} color="#111" />
                <Text style={styles.smallActionText}>Crear</Text>
              </Pressable>
            </View>

            <View style={styles.searchShell}>
              <Ionicons name="search-outline" size={19} color="#667085" />
              <TextInput
                autoCapitalize="none"
                onChangeText={setSearch}
                placeholder="Buscar proyecto, empresa o etapa"
                placeholderTextColor="#8d95a1"
                style={styles.searchInput}
                value={search}
              />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} style={styles.clearButton}>
                  <Ionicons name="close" size={18} color="#475467" />
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              contentContainerStyle={styles.tabsContent}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabs}
            >
              {projectTabs.map((item) => (
                <Pressable
                  key={String(item.key)}
                  onPress={() => setTab(item.key)}
                  style={[styles.tabButton, tab === item.key && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.tabCount, tab === item.key && styles.tabTextActive]}>
                    {item.count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {loading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color="#111" />
                <Text style={styles.stateText}>Cargando proyectos...</Text>
              </View>
            ) : projectsWithFavorites.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="folder-open-outline" size={34} color="#68707b" />
                <Text style={styles.emptyTitle}>No hay proyectos visibles</Text>
                <Text style={styles.stateText}>Tu usuario no tiene proyectos activos asignados.</Text>
              </View>
            ) : filteredProjects.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="search-outline" size={34} color="#68707b" />
                <Text style={styles.emptyTitle}>Sin resultados</Text>
                <Text style={styles.stateText}>Prueba con otro estado o búsqueda.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    onPress={() => setSelectedProject({ project })}
                    project={project}
                  />
                ))}
              </View>
            )}
          </>
        ) : mainTab === "tickets" ? (
          <TicketsPanel
            projects={projectsWithFavorites}
            tickets={ticketsResult?.tickets}
            user={user}
          />
        ) : (
          <HoursPanel
            onOpenTask={(projectId, taskId) => {
              const project = projectsWithFavorites.find((item) => item.id === projectId);
              if (project) setSelectedProject({ project, taskId });
            }}
            summary={workResult}
            user={user}
          />
        )}
      </ScrollView>

      <NotificationsModal
        notifications={(notificationsResult?.notifications ?? []) as NotificationItem[]}
        onClose={() => setNotificationsOpen(false)}
        onOpenLinked={async (notification) => {
          await markNotificationRead({
            profileId: user.id,
            notificationId: notification.id,
          }).catch(() => {});
          const project = projectsWithFavorites.find((item) => item.id === notification.projectId);
          if (project) {
            setNotificationsOpen(false);
            setSelectedProject({
              project,
              taskId: notification.taskId ?? undefined,
            });
          } else {
            Alert.alert("Sin enlace", "Esta notificación no tiene proyecto visible en la app.");
          }
        }}
        visible={notificationsOpen}
      />
      <CreateProjectModal
        onClose={() => setCreateProjectOpen(false)}
        onCreated={() => {
          setCreateProjectOpen(false);
          setMainTab("proyectos");
          setTab("todos");
        }}
        user={user}
        visible={createProjectOpen}
      />
    </SafeAreaView>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function bandColors(band: Project["band"]) {
  if (band === "critical") return { bg: "#fee4e2", fg: "#b42318" };
  if (band === "risk") return { bg: "#fef0c7", fg: "#b54708" };
  if (band === "healthy") return { bg: "#dcfae6", fg: "#067647" };
  return { bg: "#eef2f6", fg: "#344054" };
}

function isImageUri(value?: string | null) {
  if (!value) return false;
  return /^(https?:|file:|data:image\/|blob:)/i.test(value);
}

function projectIconImageUri(project: Project) {
  const candidates = [
    project.iconUrl,
    project.iconoUrl,
    project.logoUrl,
    project.imageUrl,
    PROJECT_ICON_URL_FALLBACKS[project.id as string],
    project.icon,
  ];
  return candidates.find(isImageUri) ?? null;
}

function ProjectIcon({ project }: { project: Project }) {
  const imageUri = projectIconImageUri(project);
  const iconName =
    !imageUri && project.icon && project.icon in Ionicons.glyphMap
      ? (project.icon as keyof typeof Ionicons.glyphMap)
      : null;
  const fallbackText =
    project.icon && !imageUri && !iconName && project.icon.length <= 2
      ? project.icon
      : project.name.slice(0, 1).toUpperCase();

  return (
    <View style={styles.projectIcon}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.projectIconImage} />
      ) : iconName ? (
        <Ionicons name={iconName} size={23} color="#111" />
      ) : (
        <Text style={styles.projectIconText}>{fallbackText}</Text>
      )}
    </View>
  );
}

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.projectCard}>
      <View style={styles.projectHead}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.projectOpenArea, pressed && styles.cardPressed]}
        >
          <ProjectIcon project={project} />
          <View style={styles.projectTitleBox}>
            <Text numberOfLines={1} style={styles.company}>{project.company}</Text>
            <Text numberOfLines={2} style={styles.projectName}>{project.name}</Text>
          </View>
        </Pressable>
        <View style={styles.projectCardActions}>
          {project.isFavorite ? (
            <View style={styles.favoriteBadge}>
              <Ionicons name="star" size={17} color="#111" />
            </View>
          ) : null}
          <Pressable onPress={() => setExpanded((value) => !value)} style={styles.expandButton}>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color="#111" />
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={styles.projectDetails}>
          <View style={styles.metaRow}>
            <Ionicons name="git-branch-outline" size={16} color="#667085" />
            <Text numberOfLines={1} style={styles.metaText}>{project.phase}</Text>
          </View>

          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Avance</Text>
            <Text style={styles.progressNumber}>{project.percent}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${project.percent}%` }]} />
          </View>

          <View style={styles.metrics}>
            <Metric icon="calendar-outline" label="Entrega" value={project.dueDate} />
            <Metric icon="list-outline" label="Pendientes" value={`${project.tasks.pending}/${project.tasks.total}`} />
            <Metric icon="alert-circle-outline" label="Atrasadas" value={`${project.tasks.overdue}`} />
          </View>

          {project.url ? (
            <Pressable onPress={() => Linking.openURL(project.url!)} style={styles.linkButton}>
              <Ionicons name="open-outline" size={17} color="#111" />
              <Text style={styles.linkButtonText}>Abrir sitio</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color="#667085" />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function CreateProjectModal({
  user,
  visible,
  onClose,
  onCreated,
}: {
  user: SessionUser;
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const options = useQuery(
    (api as any).mobile.getProjectCreateOptions,
    visible ? { profileId: user.id } : "skip",
  ) as ProjectCreateOptions | undefined;
  const createProject = useMutation((api as any).mobile.createProject);
  const generateUploadUrl = useMutation((api as any).mobile.generateMobileUploadUrl);
  const [tab, setTab] = useState<ProjectCreateTab>("info");
  const [openDropdown, setOpenDropdown] = useState<ProjectCreateDropdown>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [iconImage, setIconImage] = useState<PickedAttachment | null>(null);
  const [companyId, setCompanyId] = useState<Id<"empresas"> | null>(null);
  const [ownerIds, setOwnerIds] = useState<Id<"profile">[]>([user.id]);
  const [teamIds, setTeamIds] = useState<Id<"profile">[]>([]);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle>("activo");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [templateKey, setTemplateKey] = useState("__default__");
  const [phases, setPhases] = useState<ProjectPhaseDraft[]>(DEFAULT_PROJECT_PHASES);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [documents, setDocuments] = useState<PickedAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTab("info");
    setOpenDropdown(null);
    setName("");
    setIcon("");
    setIconImage(null);
    setCompanyId(null);
    setOwnerIds([user.id]);
    setTeamIds([]);
    setLifecycle("activo");
    setUrl("");
    setNotes("");
    setTemplateKey("__default__");
    setPhases(DEFAULT_PROJECT_PHASES.map((phase) => ({ ...phase })));
    setCurrentPhaseIndex(0);
    setDocuments([]);
    setSaving(false);
  }, [user.id, visible]);

  useEffect(() => {
    if (!visible || companyId || !options?.companies.length) return;
    setCompanyId(options.companies[0].id);
  }, [companyId, options?.companies, visible]);

  const companyOptions = useMemo(
    () => (options?.companies ?? []).map((company) => ({ key: company.id, label: company.name })),
    [options?.companies],
  );
  const templateOptions = useMemo(
    () => [
      { key: "__default__", label: "Predeterminada" },
      ...(options?.templates ?? []).map((template) => ({
        key: template.id as string,
        label: template.name,
      })),
    ],
    [options?.templates],
  );
  const ownerOptions = useMemo(
    () =>
      (options?.people ?? [])
        .filter(
          (person) =>
            person.role === "admin" ||
            (person.role === "encargado" &&
              (!companyId || person.companyId === companyId)),
        )
        .map((person) => ({
          key: person.id,
          label: `${person.name}${person.role ? ` · ${person.role}` : ""}`,
        })),
    [companyId, options?.people],
  );
  const teamOptions = useMemo(
    () =>
      (options?.people ?? [])
        .filter((person) => ["programador", "empleado", "diseñador"].includes(person.role))
        .map((person) => ({
          key: person.id,
          label: `${person.name}${person.role ? ` · ${person.role}` : ""}`,
        })),
    [options?.people],
  );
  const selectedCompany = companyOptions.find((item) => item.key === companyId);
  const selectedLifecycle = PROJECT_LIFECYCLE_OPTIONS.find((item) => item.key === lifecycle);
  const selectedTemplate = templateOptions.find((item) => item.key === templateKey);
  const selectedPhase = phases[currentPhaseIndex];
  const phaseOptions = phases.map((phase, index) => ({
    key: index,
    label: phase.name.trim() || `Fase ${index + 1}`,
  }));
  const selectedOwners = ownerOptions.filter((item) => ownerIds.includes(item.key));
  const selectedTeam = teamOptions.filter((item) => teamIds.includes(item.key));

  const applyTemplate = useCallback(
    (key: string) => {
      setTemplateKey(key);
      if (key === "__default__") {
        setPhases(DEFAULT_PROJECT_PHASES.map((phase) => ({ ...phase })));
        setCurrentPhaseIndex(0);
        return;
      }
      const template = options?.templates.find((item) => item.id === key);
      if (!template) return;
      setPhases(
        template.phases.map((phase) => ({
          completed: false,
          dueDate: phase.dueDate ?? "",
          name: phase.name,
        })),
      );
      setCurrentPhaseIndex(0);
    },
    [options?.templates],
  );

  const toggleId = useCallback(
    (id: Id<"profile">, setter: (value: Id<"profile">[]) => void, current: Id<"profile">[]) => {
      setter(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    },
    [],
  );

  const setPhase = useCallback((index: number, patch: Partial<ProjectPhaseDraft>) => {
    setPhases((current) =>
      current.map((phase, phaseIndex) =>
        phaseIndex === index ? { ...phase, ...patch } : phase,
      ),
    );
  }, []);

  const movePhase = useCallback((index: number, direction: -1 | 1) => {
    setPhases((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      setCurrentPhaseIndex((currentIndex) => {
        if (currentIndex === index) return nextIndex;
        if (currentIndex === nextIndex) return index;
        return currentIndex;
      });
      return next;
    });
  }, []);

  const removePhase = useCallback((index: number) => {
    setPhases((current) => {
      const next = current.filter((_, phaseIndex) => phaseIndex !== index);
      setCurrentPhaseIndex((currentIndex) => Math.min(currentIndex, Math.max(0, next.length - 1)));
      return next.length > 0 ? next : [{ name: "", dueDate: "", completed: false }];
    });
  }, []);

  const pickIcon = useCallback(async () => {
    try {
      const image = await pickImageAttachment();
      if (!image) return;
      setIconImage(image);
      setIcon("");
    } catch (error) {
      Alert.alert("No se pudo seleccionar", error instanceof Error ? error.message : "Intenta de nuevo.");
    }
  }, []);

  const pickDocuments = useCallback(async () => {
    try {
      const attachments = await pickAttachments();
      if (attachments.length === 0) return;
      setDocuments((current) => [...current, ...attachments]);
    } catch (error) {
      Alert.alert("No se pudo seleccionar", error instanceof Error ? error.message : "Intenta de nuevo.");
    }
  }, []);

  const save = useCallback(async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Falta nombre", "Ingresa el nombre del proyecto.");
      return;
    }
    if (!companyId) {
      Alert.alert("Falta empresa", "Selecciona una empresa.");
      return;
    }

    const cleanPhases = phases
      .map((phase) => ({
        completed: phase.completed,
        dueDate: phase.dueDate.trim(),
        name: phase.name.trim(),
      }))
      .filter((phase) => phase.name.length > 0);
    if (cleanPhases.length === 0) {
      Alert.alert("Faltan fases", "Agrega al menos una fase.");
      return;
    }

    setSaving(true);
    try {
      const iconUpload =
        iconImage != null
          ? await uploadPickedAttachments([iconImage], () =>
              generateUploadUrl({ profileId: user.id }),
            )
          : null;
      const documentUpload =
        documents.length > 0
          ? await uploadPickedAttachments(documents, () =>
              generateUploadUrl({ profileId: user.id }),
            )
          : { storageIds: [] };

      await createProject({
        companyId,
        currentPhaseIndex,
        documentation: documentUpload.storageIds,
        icon: icon.trim() || undefined,
        iconoStorageId: iconUpload?.storageIds[0],
        lifecycle,
        name: cleanName,
        notes: notes.trim() || undefined,
        ownerIds,
        phases: cleanPhases.map((phase) => ({
          completada: phase.completed,
          fechaEstimada: phase.dueDate,
          nombre: phase.name,
        })),
        profileId: user.id,
        teamIds,
        url: url.trim() || undefined,
      });
      onCreated();
    } catch (error) {
      Alert.alert("No se pudo crear", error instanceof Error ? error.message : "Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [
    companyId,
    createProject,
    currentPhaseIndex,
    documents,
    generateUploadUrl,
    icon,
    iconImage,
    lifecycle,
    name,
    notes,
    onCreated,
    ownerIds,
    phases,
    teamIds,
    url,
    user.id,
  ]);

  const modalTabs = [
    { key: "info" as const, label: "Info", icon: "information-circle-outline" as const },
    { key: "equipo" as const, label: "Equipo", icon: "people-outline" as const },
    { key: "fases" as const, label: "Fases", icon: "git-branch-outline" as const },
    { key: "archivos" as const, label: "Archivos", icon: "folder-open-outline" as const },
  ];

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
          <Text style={styles.modalTitle}>Crear proyecto</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          {options === undefined ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color="#111" />
              <Text style={styles.stateText}>Cargando opciones...</Text>
            </View>
          ) : !options.canCreate ? (
            <View style={styles.stateCard}>
              <Ionicons name="lock-closed-outline" size={34} color="#68707b" />
              <Text style={styles.emptyTitle}>Sin permiso</Text>
              <Text style={styles.stateText}>Tu perfil no puede crear proyectos.</Text>
            </View>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.projectTabsContent}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {modalTabs.map((item) => {
                  const active = tab === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setTab(item.key)}
                      style={[styles.projectTabButton, active && styles.projectTabButtonActive]}
                    >
                      <Ionicons name={item.icon} size={16} color="#111" />
                      <Text style={[styles.projectTabText, active && styles.projectTabTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {tab === "info" ? (
                <>
                  <View style={styles.projectIconPicker}>
                    <View style={styles.projectIconLarge}>
                      {iconImage ? (
                        <Image source={{ uri: iconImage.uri }} style={styles.projectIconImage} />
                      ) : (
                        <Text style={styles.projectIconLargeText}>{icon || "P"}</Text>
                      )}
                    </View>
                    <View style={styles.projectIconPickerBody}>
                      <View style={styles.iconSwatchGrid}>
                        {PROJECT_ICON_OPTIONS.map((item) => {
                          const active = icon === item && !iconImage;
                          return (
                            <Pressable
                              key={item}
                              onPress={() => {
                                setIcon(active ? "" : item);
                                setIconImage(null);
                              }}
                              style={[styles.iconSwatch, active && styles.iconSwatchActive]}
                            >
                              <Text style={styles.iconSwatchText}>{item}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.inlineActions}>
                        <Pressable onPress={pickIcon} style={styles.smallActionButton}>
                          <Ionicons name="image-outline" size={17} color="#111" />
                          <Text style={styles.smallActionText}>Imagen</Text>
                        </Pressable>
                        {iconImage ? (
                          <Pressable
                            onPress={() => setIconImage(null)}
                            style={styles.secondarySmallButton}
                          >
                            <Ionicons name="trash-outline" size={17} color="#b42318" />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Nombre</Text>
                    <View style={styles.inputShell}>
                      <Ionicons name="folder-outline" size={19} color="#7a8088" />
                      <TextInput
                        onChangeText={setName}
                        placeholder="Nombre del proyecto"
                        placeholderTextColor="#9aa0a8"
                        style={styles.input}
                        value={name}
                      />
                    </View>
                  </View>

                  <SelectDropdown
                    icon="business-outline"
                    label="Empresa"
                    onOpenChange={(open) => setOpenDropdown(open ? "company" : null)}
                    onSelect={(value) => setCompanyId(value)}
                    open={openDropdown === "company"}
                    options={companyOptions}
                    value={companyId}
                    valueLabel={selectedCompany?.label ?? "Seleccionar empresa"}
                  />

                  <SelectDropdown
                    icon="pulse-outline"
                    label="Estado del proyecto"
                    onOpenChange={(open) => setOpenDropdown(open ? "lifecycle" : null)}
                    onSelect={setLifecycle}
                    open={openDropdown === "lifecycle"}
                    options={PROJECT_LIFECYCLE_OPTIONS}
                    value={lifecycle}
                    valueLabel={selectedLifecycle?.label ?? "Activo"}
                  />

                  <SelectDropdown
                    icon="flag-outline"
                    label="Etapa inicial"
                    onOpenChange={(open) => setOpenDropdown(open ? "phase" : null)}
                    onSelect={setCurrentPhaseIndex}
                    open={openDropdown === "phase"}
                    options={phaseOptions}
                    value={currentPhaseIndex}
                    valueLabel={selectedPhase?.name || "Seleccionar fase"}
                  />

                  <View style={styles.field}>
                    <Text style={styles.label}>URL</Text>
                    <View style={styles.inputShell}>
                      <Ionicons name="link-outline" size={19} color="#7a8088" />
                      <TextInput
                        autoCapitalize="none"
                        onChangeText={setUrl}
                        placeholder="https://..."
                        placeholderTextColor="#9aa0a8"
                        style={styles.input}
                        value={url}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Notas</Text>
                    <TextInput
                      multiline
                      onChangeText={setNotes}
                      placeholder="Notas internas del proyecto"
                      placeholderTextColor="#9aa0a8"
                      style={styles.textarea}
                      value={notes}
                    />
                  </View>
                </>
              ) : null}

              {tab === "equipo" ? (
                <>
                  <MultiSelectDropdown
                    icon="person-circle-outline"
                    label="Encargados"
                    onOpenChange={(open) => setOpenDropdown(open ? "company" : null)}
                    onToggle={(value) => toggleId(value, setOwnerIds, ownerIds)}
                    open={openDropdown === "company"}
                    options={ownerOptions}
                    value={ownerIds}
                    valueLabel={
                      selectedOwners.length > 0
                        ? selectedOwners.map((item) => item.label.split(" · ")[0]).join(", ")
                        : "Sin encargados"
                    }
                  />
                  <MultiSelectDropdown
                    icon="construct-outline"
                    label="Equipo"
                    onOpenChange={(open) => setOpenDropdown(open ? "template" : null)}
                    onToggle={(value) => toggleId(value, setTeamIds, teamIds)}
                    open={openDropdown === "template"}
                    options={teamOptions}
                    value={teamIds}
                    valueLabel={
                      selectedTeam.length > 0
                        ? selectedTeam.map((item) => item.label.split(" · ")[0]).join(", ")
                        : "Sin equipo"
                    }
                  />
                </>
              ) : null}

              {tab === "fases" ? (
                <>
                  <SelectDropdown
                    icon="albums-outline"
                    label="Plantilla"
                    onOpenChange={(open) => setOpenDropdown(open ? "template" : null)}
                    onSelect={applyTemplate}
                    open={openDropdown === "template"}
                    options={templateOptions}
                    value={templateKey}
                    valueLabel={selectedTemplate?.label ?? "Predeterminada"}
                  />
                  <View style={styles.phaseEditorList}>
                    {phases.map((phase, index) => (
                      <View key={`${index}-${phase.name}`} style={styles.phaseEditorRow}>
                        <View style={styles.phaseMoveButtons}>
                          <Pressable onPress={() => movePhase(index, -1)} style={styles.inlineIconButton}>
                            <Ionicons name="chevron-up" size={16} color="#111" />
                          </Pressable>
                          <Pressable onPress={() => movePhase(index, 1)} style={styles.inlineIconButton}>
                            <Ionicons name="chevron-down" size={16} color="#111" />
                          </Pressable>
                        </View>
                        <View style={styles.phaseEditorFields}>
                          <TextInput
                            onChangeText={(value) => setPhase(index, { name: value })}
                            placeholder="Nombre de fase"
                            placeholderTextColor="#9aa0a8"
                            style={styles.compactInput}
                            value={phase.name}
                          />
                          <TextInput
                            autoCapitalize="none"
                            onChangeText={(value) => setPhase(index, { dueDate: value })}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9aa0a8"
                            style={styles.compactInput}
                            value={phase.dueDate}
                          />
                        </View>
                        <View style={styles.phaseRowActions}>
                          <Pressable
                            onPress={() => setPhase(index, { completed: !phase.completed })}
                            style={[
                              styles.inlineIconButton,
                              phase.completed && styles.inlineIconButtonActive,
                            ]}
                          >
                            <Ionicons name="checkmark" size={16} color="#111" />
                          </Pressable>
                          <Pressable onPress={() => removePhase(index)} style={styles.inlineIconButton}>
                            <Ionicons name="trash-outline" size={16} color="#b42318" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() =>
                      setPhases((current) => [
                        ...current,
                        { completed: false, dueDate: "", name: "" },
                      ])
                    }
                    style={styles.secondaryButton}
                  >
                    <Ionicons name="add" size={18} color="#111" />
                    <Text style={styles.secondaryButtonText}>Agregar fase</Text>
                  </Pressable>
                </>
              ) : null}

              {tab === "archivos" ? (
                <>
                  <Pressable onPress={pickDocuments} style={styles.dropdownShell}>
                    <Ionicons name="cloud-upload-outline" size={19} color="#7a8088" />
                    <Text style={styles.dropdownValue}>Subir documentación</Text>
                    <Ionicons name="add" size={18} color="#111" />
                  </Pressable>
                  {documents.length > 0 ? (
                    <View style={styles.selectedAttachments}>
                      {documents.map((attachment, index) => (
                        <View key={`${attachment.uri}-${index}`} style={styles.selectedAttachment}>
                          <Ionicons name="document-attach-outline" size={18} color="#667085" />
                          <View style={styles.selectedAttachmentTextBox}>
                            <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                            <Text style={styles.attachmentMeta}>{formatFileSize(attachment.size)}</Text>
                          </View>
                          <Pressable
                            onPress={() =>
                              setDocuments((current) =>
                                current.filter((_, attachmentIndex) => attachmentIndex !== index),
                              )
                            }
                            style={styles.inlineIconButton}
                          >
                            <Ionicons name="close" size={16} color="#111" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.stateCard}>
                      <Ionicons name="folder-open-outline" size={34} color="#68707b" />
                      <Text style={styles.stateText}>Sin documentación seleccionada.</Text>
                    </View>
                  )}
                </>
              ) : null}

              <View style={styles.modalFooter}>
                <Pressable disabled={saving} onPress={onClose} style={styles.secondaryButton}>
                  <Ionicons name="close" size={18} color="#111" />
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={save} style={[styles.primaryButton, styles.modalSaveButton, saving && styles.pressed]}>
                  {saving ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <>
                      <Text style={styles.primaryText}>Crear proyecto</Text>
                      <Ionicons name="checkmark" size={20} color="#111" />
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TicketsPanel({
  user,
  tickets,
  projects,
}: {
  user: SessionUser;
  tickets?: TicketItem[];
  projects: Project[];
}) {
  const createTicket = useMutation((api as any).mobile.createMobileTicket);
  const updateStatus = useMutation((api as any).mobile.updateMobileTicketStatus);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<Id<"proyectos"> | null>(projects[0]?.id ?? null);
  const [priority, setPriority] = useState<(typeof TICKET_PRIORITY_OPTIONS)[number]["key"]>("medium");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<Id<"tickets"> | null>(null);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const saveTicket = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("Falta título", "Ingresa el título del ticket.");
      return;
    }
    setSaving(true);
    try {
      await createTicket({
        description: description.trim(),
        priority,
        profileId: user.id,
        projectId: projectId ?? undefined,
        title: title.trim(),
        type: "support",
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCreateOpen(false);
    } catch (error) {
      Alert.alert("No se pudo crear", error instanceof Error ? error.message : "Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [createTicket, description, priority, projectId, title, user.id]);

  const changeStatus = useCallback(
    async (ticket: TicketItem, status: (typeof TICKET_STATUS_OPTIONS)[number]["key"]) => {
      setUpdatingId(ticket.id);
      try {
        await updateStatus({ profileId: user.id, status, ticketId: ticket.id });
      } catch (error) {
        Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Intenta de nuevo.");
      } finally {
        setUpdatingId(null);
      }
    },
    [updateStatus, user.id],
  );

  if (tickets === undefined) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color="#111" />
        <Text style={styles.stateText}>Cargando tickets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.panelStack}>
      <Pressable onPress={() => setCreateOpen(true)} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Crear ticket</Text>
        <Ionicons name="add" size={21} color="#111" />
      </Pressable>

      {tickets.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="ticket-outline" size={34} color="#68707b" />
          <Text style={styles.emptyTitle}>Sin tickets</Text>
          <Text style={styles.stateText}>Crea el primer ticket desde la app.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {tickets.map((ticket) => (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={styles.projectHead}>
                <View style={styles.projectTitleBox}>
                  <Text numberOfLines={2} style={styles.taskTitle}>{ticket.title}</Text>
                  <Text numberOfLines={1} style={styles.taskMeta}>
                    {ticket.projectName} · {ticket.createdLabel}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: ticket.status === "cerrado" ? "#dcfae6" : "#fef0c7" }]}>
                  <Text style={[styles.chipText, { color: ticket.status === "cerrado" ? "#067647" : "#b54708" }]}>
                    {ticket.status}
                  </Text>
                </View>
              </View>
              {ticket.description ? (
                <Text numberOfLines={3} style={styles.taskDescription}>{ticket.description}</Text>
              ) : null}
              <View style={styles.statusGrid}>
                {TICKET_STATUS_OPTIONS.map((item) => (
                  <Pressable
                    disabled={updatingId != null}
                    key={item.key}
                    onPress={() => changeStatus(ticket, item.key)}
                    style={[
                      styles.statusOption,
                      ticket.status === item.key && styles.statusOptionActive,
                      updatingId === ticket.id && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      ticket.status === item.key && styles.statusOptionTextActive,
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <Modal animationType="slide" onRequestClose={() => setCreateOpen(false)} visible={createOpen}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setCreateOpen(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color="#111" />
            </Pressable>
            <Text style={styles.modalTitle}>Crear ticket</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Título</Text>
              <View style={styles.inputShell}>
                <Ionicons name="ticket-outline" size={19} color="#7a8088" />
                <TextInput
                  onChangeText={setTitle}
                  placeholder="Qué necesitas resolver"
                  placeholderTextColor="#9aa0a8"
                  style={styles.input}
                  value={title}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                multiline
                onChangeText={setDescription}
                placeholder="Contexto del ticket"
                placeholderTextColor="#9aa0a8"
                style={styles.textarea}
                value={description}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Proyecto</Text>
              <View style={styles.statusGrid}>
                {projects.slice(0, 8).map((project) => (
                  <Pressable
                    key={project.id}
                    onPress={() => setProjectId(project.id)}
                    style={[styles.statusOption, projectId === project.id && styles.statusOptionActive]}
                  >
                    <Text style={[styles.statusOptionText, projectId === project.id && styles.statusOptionTextActive]}>
                      {project.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Prioridad</Text>
              <View style={styles.statusGrid}>
                {TICKET_PRIORITY_OPTIONS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setPriority(item.key)}
                    style={[styles.statusOption, priority === item.key && styles.statusOptionActive]}
                  >
                    <Text style={[styles.statusOptionText, priority === item.key && styles.statusOptionTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable disabled={saving} onPress={saveTicket} style={[styles.primaryButton, saving && styles.pressed]}>
              {saving ? <ActivityIndicator color="#111" /> : <Text style={styles.primaryText}>Guardar ticket</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function HoursPanel({
  user,
  summary,
  onOpenTask,
}: {
  user: SessionUser;
  summary?: WorkSummary;
  onOpenTask: (projectId: Id<"proyectos"> | null, taskId: Id<"tareas">) => void;
}) {
  const pauseTimer = useMutation((api as any).mobile.pauseTaskTimer);
  const stopTimer = useMutation((api as any).mobile.stopTaskTimer);
  const [busy, setBusy] = useState<"pause" | "stop" | null>(null);

  const activeTaskId = summary?.activeTimer?.taskId;
  const actOnTimer = useCallback(
    async (action: "pause" | "stop") => {
      if (!activeTaskId) return;
      setBusy(action);
      try {
        const fn = action === "pause" ? pauseTimer : stopTimer;
        await fn({ profileId: user.id, taskId: activeTaskId });
      } catch (error) {
        Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Intenta de nuevo.");
      } finally {
        setBusy(null);
      }
    },
    [activeTaskId, pauseTimer, stopTimer, user.id],
  );

  if (summary === undefined) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color="#111" />
        <Text style={styles.stateText}>Cargando horas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.panelStack}>
      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Hoy</Text>
        <Text style={styles.bigNumber}>{summary.todayLabel}</Text>
        <Text style={styles.stateText}>Tiempo registrado en sesiones cerradas.</Text>
      </View>

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Timer activo</Text>
        {summary.activeTimer ? (
          <>
            <Text style={styles.taskTitle}>{summary.activeTimer.taskTitle}</Text>
            <Text style={styles.taskMeta}>{summary.activeTimer.projectName}</Text>
            <Text style={styles.bigNumber}>{summary.activeTimer.workedLabel}</Text>
            <View style={styles.inlineActions}>
              <Pressable
                disabled={busy != null}
                onPress={() => actOnTimer("pause")}
                style={styles.smallActionButton}
              >
                {busy === "pause" ? <ActivityIndicator color="#111" /> : <Ionicons name="pause" size={17} color="#111" />}
                <Text style={styles.smallActionText}>Pausar</Text>
              </Pressable>
              <Pressable
                disabled={busy != null}
                onPress={() => actOnTimer("stop")}
                style={styles.smallActionButton}
              >
                {busy === "stop" ? <ActivityIndicator color="#111" /> : <Ionicons name="stop" size={17} color="#111" />}
                <Text style={styles.smallActionText}>Detener</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.stateText}>No hay timer corriendo. Inicia uno desde el detalle de una tarea.</Text>
        )}
      </View>

      {summary.pausedTimers.length > 0 ? (
        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Pausados</Text>
          {summary.pausedTimers.map((timer) => (
            <View key={timer.taskId} style={styles.attachmentRow}>
              <Ionicons name="pause-circle-outline" size={18} color="#667085" />
              <Text numberOfLines={1} style={styles.attachmentName}>{timer.taskTitle}</Text>
              <Text style={styles.taskMeta}>{timer.workedLabel}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.detailCard}>
        <Text style={styles.sectionTitle}>Últimos registros</Text>
        {summary.logs.length === 0 ? (
          <Text style={styles.stateText}>Sin registros todavía.</Text>
        ) : (
          summary.logs.map((log) => (
            <View
              key={log.id}
              style={styles.logRow}
            >
              <View style={styles.projectTitleBox}>
                <Text numberOfLines={1} style={styles.taskTitle}>{log.taskTitle}</Text>
                <Text numberOfLines={1} style={styles.taskMeta}>{log.projectName} · {log.startedLabel}</Text>
              </View>
              <Text style={styles.metricValue}>{log.durationLabel}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function SelectDropdown<T extends string | number>({
  allowClear = false,
  icon,
  label,
  onClear,
  onOpenChange,
  onSelect,
  open,
  options,
  value,
  valueLabel,
}: {
  allowClear?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onClear?: () => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (value: T) => void;
  open: boolean;
  options: Array<{ key: T; label: string }>;
  value: T | null;
  valueLabel: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => onOpenChange(!open)} style={styles.dropdownShell}>
        <Ionicons name={icon} size={19} color="#7a8088" />
        <Text numberOfLines={1} style={styles.dropdownValue}>{valueLabel}</Text>
        {allowClear && value != null ? (
          <Pressable
            onPress={() => {
              onClear?.();
              onOpenChange(false);
            }}
            style={styles.dropdownClear}
          >
            <Ionicons name="close" size={16} color="#667085" />
          </Pressable>
        ) : null}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#111" />
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((item) => {
            const active = item.key === value;
            return (
              <Pressable
                key={String(item.key)}
                onPress={() => {
                  onSelect(item.key);
                  onOpenChange(false);
                }}
                style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}
                >
                  {item.label}
                </Text>
                {active ? <Ionicons name="checkmark" size={17} color="#111" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function MultiSelectDropdown<T extends string>({
  icon,
  label,
  onOpenChange,
  onToggle,
  open,
  options,
  value,
  valueLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onOpenChange: (open: boolean) => void;
  onToggle: (value: T) => void;
  open: boolean;
  options: Array<{ key: T; label: string }>;
  value: T[];
  valueLabel: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => onOpenChange(!open)} style={styles.dropdownShell}>
        <Ionicons name={icon} size={19} color="#7a8088" />
        <Text numberOfLines={1} style={styles.dropdownValue}>{valueLabel}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#111" />
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((item) => {
            const active = value.includes(item.key);
            return (
              <Pressable
                key={String(item.key)}
                onPress={() => onToggle(item.key)}
                style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}
                >
                  {item.label}
                </Text>
                <Ionicons
                  name={active ? "checkbox" : "square-outline"}
                  size={17}
                  color={active ? "#111" : "#98a2b3"}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function TaskFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  tag,
  onTagChange,
  dueDate,
  onDueDateChange,
  phaseIndex,
  onPhaseIndexChange,
  ownerIds,
  onOwnerIdsChange,
  phases,
  members,
  statusLabel = "Estado",
  attachments,
  onPickAttachments,
  onRemoveAttachment,
  attachmentsDisabled = false,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  status: TaskStatus;
  onStatusChange: (value: TaskStatus) => void;
  priority: TaskPriority | null;
  onPriorityChange: (value: TaskPriority | null) => void;
  tag: string;
  onTagChange: (value: string) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  phaseIndex: number | null;
  onPhaseIndexChange: (value: number | null) => void;
  ownerIds: Id<"profile">[];
  onOwnerIdsChange: (value: Id<"profile">[]) => void;
  phases: ProjectPhase[];
  members: ProjectMember[];
  statusLabel?: string;
  attachments?: PickedAttachment[];
  onPickAttachments?: () => void | Promise<void>;
  onRemoveAttachment?: (index: number) => void;
  attachmentsDisabled?: boolean;
}) {
  const [openDropdown, setOpenDropdown] = useState<TaskFormDropdown>(null);
  const selectedStatus = TASK_STATUS_OPTIONS.find((item) => item.key === status);
  const selectedPriority = PRIORITY_OPTIONS.find((item) => item.key === priority);
  const selectedPhase = phases.find((phase) => phase.index === phaseIndex);
  const selectedOwners = members.filter((member) => ownerIds.includes(member.id));

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Título</Text>
        <View style={styles.inputShell}>
          <Ionicons name="create-outline" size={19} color="#7a8088" />
          <TextInput
            onChangeText={onTitleChange}
            placeholder="Nombre de la tarea"
            placeholderTextColor="#9aa0a8"
            style={styles.input}
            value={title}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          multiline
          onChangeText={onDescriptionChange}
          placeholder="Detalle breve de lo que se debe hacer"
          placeholderTextColor="#9aa0a8"
          style={styles.textarea}
          value={description}
        />
      </View>

      <SelectDropdown
        icon="flag-outline"
        label={statusLabel}
        onOpenChange={(open) => setOpenDropdown(open ? "status" : null)}
        onSelect={(value) => onStatusChange(value)}
        open={openDropdown === "status"}
        options={TASK_STATUS_OPTIONS}
        value={status}
        valueLabel={selectedStatus?.label ?? "Seleccionar estado"}
      />

      <SelectDropdown
        allowClear
        icon="alert-circle-outline"
        label="Prioridad"
        onOpenChange={(open) => setOpenDropdown(open ? "priority" : null)}
        onSelect={(value) => onPriorityChange(value)}
        onClear={() => onPriorityChange(null)}
        open={openDropdown === "priority"}
        options={PRIORITY_OPTIONS}
        value={priority}
        valueLabel={selectedPriority?.label ?? "Sin prioridad"}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Etiqueta</Text>
        <View style={styles.inputShell}>
          <Ionicons name="pricetag-outline" size={19} color="#7a8088" />
          <TextInput
            onChangeText={onTagChange}
            placeholder="Web, App, portal..."
            placeholderTextColor="#9aa0a8"
            style={styles.input}
            value={tag}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Fecha de entrega</Text>
        <View style={styles.inputShell}>
          <Ionicons name="calendar-outline" size={19} color="#7a8088" />
          <TextInput
            keyboardType="numbers-and-punctuation"
            onChangeText={onDueDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9aa0a8"
            style={styles.input}
            value={dueDate}
          />
        </View>
      </View>

      {phases.length > 0 ? (
        <SelectDropdown
          icon="layers-outline"
          label="Fase"
          onOpenChange={(open) => setOpenDropdown(open ? "phase" : null)}
          onSelect={(value) => onPhaseIndexChange(value)}
          open={openDropdown === "phase"}
          options={phases.map((phase) => ({ key: phase.index, label: phase.name }))}
          value={phaseIndex}
          valueLabel={selectedPhase?.name ?? "Seleccionar fase"}
        />
      ) : null}

      {members.length > 0 ? (
        <MultiSelectDropdown
          icon="people-outline"
          label="Encargados"
          onOpenChange={(open) => setOpenDropdown(open ? "owners" : null)}
          onToggle={(memberId) =>
            onOwnerIdsChange(
              ownerIds.includes(memberId)
                ? ownerIds.filter((id) => id !== memberId)
                : [...ownerIds, memberId],
            )
          }
          open={openDropdown === "owners"}
          options={members.map((member) => ({ key: member.id, label: member.name }))}
          value={ownerIds}
          valueLabel={
            selectedOwners.length > 0
              ? selectedOwners.map((member) => member.name).join(", ")
              : "Sin encargados"
          }
        />
      ) : null}

      {attachments && onPickAttachments ? (
        <View style={styles.field}>
          <Text style={styles.label}>Adjuntos</Text>
          <Pressable
            disabled={attachmentsDisabled}
            onPress={onPickAttachments}
            style={[styles.dropdownShell, attachmentsDisabled && styles.pressed]}
          >
            <Ionicons name="attach" size={19} color="#7a8088" />
            <Text numberOfLines={1} style={styles.dropdownValue}>
              {attachments.length > 0
                ? `${attachments.length} archivo${attachments.length === 1 ? "" : "s"} seleccionado${attachments.length === 1 ? "" : "s"}`
                : "Adjuntar archivos"}
            </Text>
            <Ionicons name="add" size={18} color="#111" />
          </Pressable>
          {attachments.length > 0 ? (
            <View style={styles.selectedAttachments}>
              {attachments.map((attachment, index) => (
                <View key={`${attachment.uri}-${index}`} style={styles.selectedAttachment}>
                  <Ionicons name="document-attach-outline" size={16} color="#667085" />
                  <View style={styles.selectedAttachmentTextBox}>
                    <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                    {attachment.size ? (
                      <Text style={styles.attachmentMeta}>{formatFileSize(attachment.size)}</Text>
                    ) : null}
                  </View>
                  {onRemoveAttachment ? (
                    <Pressable
                      disabled={attachmentsDisabled}
                      onPress={() => onRemoveAttachment(index)}
                      style={styles.inlineIconButton}
                    >
                      <Ionicons name="close" size={17} color="#111" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function TasksScreen({
  user,
  project,
  initialTaskId,
  onBack,
  onProjectRenamed,
}: {
  user: SessionUser;
  project: Project;
  initialTaskId?: Id<"tareas">;
  onBack: () => void;
  onProjectRenamed?: (name: string) => void;
}) {
  const result = useQuery(api.mobile.getProjectTasks, {
    profileId: user.id,
    projectId: project.id,
  });
  const projectDetail = useQuery((api as any).mobile.getProjectDetail, {
    profileId: user.id,
    projectId: project.id,
  }) as ProjectDetail | undefined;
  const createTask = useMutation(api.mobile.createProjectTask);
  const updateProjectName = useMutation((api as any).mobile.updateProjectName);
  const generateUploadUrl = useMutation((api as any).mobile.generateMobileUploadUrl);
  const addTaskAttachments = useMutation(api.tareas.addAdjuntosToTarea);
  const [sectionTab, setSectionTab] = useState<ProjectSectionTab>("tareas");
  const [statusTab, setStatusTab] = useState<"todas" | TaskStatus>("todas");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [projectName, setProjectName] = useState(project.name);
  const [projectNameDraft, setProjectNameDraft] = useState(project.name);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pendiente");
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [tag, setTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [phaseIndex, setPhaseIndex] = useState<number | null>(null);
  const [ownerIds, setOwnerIds] = useState<Id<"profile">[]>([user.id]);
  const [newTaskAttachments, setNewTaskAttachments] = useState<PickedAttachment[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tareas"> | null>(
    initialTaskId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setProjectName(project.name);
    setProjectNameDraft(project.name);
  }, [project.name]);

  const tasks = (result?.tasks ?? []) as Task[];
  const members = (result?.members ?? []) as ProjectMember[];
  const phases = (result?.phases ?? []) as ProjectPhase[];
  const projectTabs = useMemo(
    () => [
      { key: "tareas" as const, label: "Tareas", count: tasks.length, icon: "checkbox-outline" as const },
      {
        key: "etapas" as const,
        label: "Etapas",
        count: projectDetail?.phases.length ?? phases.length,
        icon: "layers-outline" as const,
      },
      {
        key: "equipo" as const,
        label: "Equipo",
        count: projectDetail?.members.length ?? members.length,
        icon: "people-outline" as const,
      },
      {
        key: "tickets" as const,
        label: "Tickets",
        count: projectDetail?.tickets.length ?? 0,
        icon: "ticket-outline" as const,
      },
      {
        key: "avances" as const,
        label: "Avances",
        count: projectDetail?.avances.length ?? 0,
        icon: "analytics-outline" as const,
      },
    ],
    [members.length, phases.length, projectDetail, tasks.length],
  );
  const statusTabs = useMemo(
    () => [
      { key: "todas" as const, label: "Todas", count: tasks.length },
      ...TASK_STATUS_OPTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        count: tasks.filter((task) => task.status === item.key).length,
      })),
    ],
    [tasks],
  );
  const filteredTasks = useMemo(() => {
    if (statusTab === "todas") return tasks;
    return tasks.filter((task) => task.status === statusTab);
  }, [statusTab, tasks]);

  const saveTask = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert("Falta título", "Ingresa el nombre de la tarea.");
      return;
    }

    setSaving(true);
    try {
      const createdTask = await createTask({
        profileId: user.id,
        projectId: project.id,
        title: title.trim(),
        description: description.trim() || undefined,
        status: newStatus,
        priority: priority ?? undefined,
        tag: tag.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        phaseIndex: phaseIndex ?? undefined,
        ownerIds,
      });
      const createdTaskId = createdTaskIdFromResult(createdTask);

      if (newTaskAttachments.length > 0) {
        if (!createdTaskId) {
          throw new Error("La tarea se creó, pero no se recibió el id para adjuntar archivos.");
        }
        const uploaded = await uploadPickedAttachments(newTaskAttachments, () =>
          generateUploadUrl({ profileId: user.id }),
        );
        await addTaskAttachments({
          adjuntoNombres: uploaded.names,
          adjuntos: uploaded.storageIds,
          tareaId: createdTaskId,
        });
      }

      setTitle("");
      setDescription("");
      setNewStatus("pendiente");
      setPriority(null);
      setTag("");
      setDueDate("");
      setPhaseIndex(null);
      setOwnerIds([user.id]);
      setNewTaskAttachments([]);
      setCreateOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo crear la tarea",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }, [addTaskAttachments, createTask, description, dueDate, generateUploadUrl, newStatus, newTaskAttachments, ownerIds, phaseIndex, priority, project.id, tag, title, user.id]);

  const pickNewTaskAttachments = useCallback(async () => {
    try {
      const attachments = await pickAttachments();
      if (attachments.length === 0) return;
      setNewTaskAttachments((current) => [...current, ...attachments]);
    } catch (error) {
      Alert.alert(
        "No se pudo seleccionar el archivo",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    }
  }, []);

  const saveProjectName = useCallback(async () => {
    const cleanName = projectNameDraft.trim();
    if (!cleanName) {
      Alert.alert("Falta nombre", "Ingresa el nombre del proyecto.");
      return;
    }

    setRenaming(true);
    try {
      await updateProjectName({
        name: cleanName,
        profileId: user.id,
        projectId: project.id,
      });
      setProjectName(cleanName);
      setProjectNameDraft(cleanName);
      onProjectRenamed?.(cleanName);
      setRenameOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo renombrar",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setRenaming(false);
    }
  }, [onProjectRenamed, project.id, projectNameDraft, updateProjectName, user.id]);

  return (
    <SafeAreaView style={styles.dashboard}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboardContent}>
        <View style={styles.detailHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </Pressable>
          <ProjectIcon project={project} />
          <View style={styles.detailTitleBox}>
            <Text numberOfLines={1} style={styles.company}>{project.company}</Text>
            <Text numberOfLines={2} style={styles.detailTitle}>{projectName}</Text>
          </View>
          <Pressable
            onPress={() => {
              setProjectNameDraft(projectName);
              setRenameOpen(true);
            }}
            style={styles.backButton}
          >
            <Ionicons name="create-outline" size={22} color="#111" />
          </Pressable>
          <Pressable onPress={() => setCreateOpen(true)} style={styles.addButton}>
            <Ionicons name="add" size={25} color="#111" />
          </Pressable>
        </View>

        <View style={styles.projectMini}>
          <View style={styles.projectSummaryTop}>
            <View style={styles.projectTitleBox}>
              <Text style={styles.projectMiniLabel}>Etapa actual</Text>
              <Text numberOfLines={1} style={styles.projectMiniValue}>
                {result?.project.phase ?? project.phase}
              </Text>
            </View>
            <View style={styles.projectPercentPill}>
              <Text style={styles.projectPercentText}>{project.percent}%</Text>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${project.percent}%` }]} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.projectTabsContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.projectTabs}
        >
          {projectTabs.map((item) => {
            const active = sectionTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSectionTab(item.key)}
                style={[styles.projectTabButton, active && styles.projectTabButtonActive]}
              >
                <Ionicons name={item.icon} size={16} color={active ? "#111" : "#667085"} />
                <Text style={[styles.projectTabText, active && styles.projectTabTextActive]}>
                  {item.label}
                </Text>
                <Text style={[styles.projectTabCount, active && styles.projectTabTextActive]}>
                  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {sectionTab === "tareas" ? (
          <>
            <View style={styles.taskSectionHeader}>
              <Text style={styles.sectionTitle}>Tareas</Text>
              <Pressable onPress={() => setCreateOpen(true)} style={styles.smallActionButton}>
                <Ionicons name="add" size={17} color="#111" />
                <Text style={styles.smallActionText}>Nueva</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.tabsContent}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabs}
            >
              {statusTabs.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setStatusTab(item.key)}
                  style={[styles.tabButton, statusTab === item.key && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, statusTab === item.key && styles.tabTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.tabCount, statusTab === item.key && styles.tabTextActive]}>
                    {item.count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {result === undefined ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color="#111" />
                <Text style={styles.stateText}>Cargando tareas...</Text>
              </View>
            ) : filteredTasks.length === 0 ? (
              <View style={styles.stateCard}>
                <Ionicons name="checkbox-outline" size={34} color="#68707b" />
                <Text style={styles.emptyTitle}>Sin tareas</Text>
                <Text style={styles.stateText}>Crea una tarea desde el campo superior.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {filteredTasks.map((task) => (
                  <TaskRow key={task.id} onPress={() => setSelectedTaskId(task.id)} task={task} />
                ))}
              </View>
            )}
          </>
        ) : null}

        {sectionTab !== "tareas" && !projectDetail ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#111" />
            <Text style={styles.stateText}>Cargando proyecto...</Text>
          </View>
        ) : null}

        {sectionTab === "etapas" && projectDetail ? (
          <View style={styles.detailCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Etapas</Text>
              <Text style={styles.taskMeta}>{projectDetail.lifecycle}</Text>
            </View>
            <View style={styles.phaseList}>
              {projectDetail.phases.map((phase) => (
                <View key={phase.index} style={[styles.phaseRow, phase.active && styles.phaseRowActive]}>
                  <View style={[styles.taskStatusDot, { backgroundColor: phase.completed ? "#067647" : phase.active ? "#111" : "#98a2b3" }]} />
                  <View style={styles.projectTitleBox}>
                    <Text numberOfLines={1} style={styles.infoTitle}>{phase.name}</Text>
                    <Text style={styles.taskMeta}>{phase.dueDate || "Sin fecha"}</Text>
                  </View>
                  {phase.active ? (
                    <Text style={styles.activeLabel}>Actual</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {sectionTab === "equipo" && projectDetail ? (
          <View style={styles.detailCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Equipo</Text>
              <Text style={styles.taskMeta}>{projectDetail.members.length}</Text>
            </View>
            {projectDetail.members.length === 0 ? (
              <Text style={styles.stateText}>Sin encargados en este proyecto.</Text>
            ) : (
              <View style={styles.infoList}>
                {projectDetail.members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>{member.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.projectTitleBox}>
                      <Text numberOfLines={1} style={styles.infoTitle}>{member.name}</Text>
                      <Text numberOfLines={1} style={styles.taskMeta}>{member.role || "Equipo"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {sectionTab === "tickets" && projectDetail ? (
          <View style={styles.detailCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tickets recientes</Text>
              <Text style={styles.taskMeta}>{projectDetail.tickets.length}</Text>
            </View>
            {projectDetail.tickets.length === 0 ? (
              <Text style={styles.stateText}>Sin tickets para este proyecto.</Text>
            ) : (
              <View style={styles.infoList}>
                {projectDetail.tickets.map((ticket) => (
                  <View key={ticket.id} style={styles.infoRow}>
                    <Ionicons name="ticket-outline" size={18} color="#667085" />
                    <View style={styles.projectTitleBox}>
                      <Text numberOfLines={1} style={styles.infoTitle}>{ticket.title}</Text>
                      <Text numberOfLines={1} style={styles.taskMeta}>
                        {ticket.status} · {ticket.priority || "Sin prioridad"} · {ticket.createdLabel}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {sectionTab === "avances" && projectDetail ? (
          <View style={styles.detailCard}>
            <View style={styles.progressBlock}>
              <View style={styles.progressTop}>
                <Text style={styles.progressLabel}>Avance del proyecto</Text>
                <Text style={styles.progressNumber}>{project.percent}%</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${project.percent}%` }]} />
              </View>
              {projectDetail.notes ? (
                <Text style={styles.projectNote}>{projectDetail.notes}</Text>
              ) : null}
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Avances</Text>
              <Text style={styles.taskMeta}>{projectDetail.avances.length}</Text>
            </View>
            {projectDetail.avances.length === 0 ? (
              <Text style={styles.stateText}>Sin avances recientes.</Text>
            ) : (
              projectDetail.avances.map((avance) => (
                <View key={avance.id} style={styles.commentBubble}>
                  <Text style={styles.commentAuthor}>{avance.name} · {avance.status}</Text>
                  {avance.description ? (
                    <Text numberOfLines={2} style={styles.commentText}>{avance.description}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      <TaskDetailModal
        members={members}
        onClose={() => setSelectedTaskId(null)}
        phases={phases}
        taskId={selectedTaskId}
        user={user}
      />

      <Modal animationType="slide" onRequestClose={() => setRenameOpen(false)} visible={renameOpen}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setRenameOpen(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color="#111" />
            </Pressable>
            <Text style={styles.modalTitle}>Renombrar proyecto</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.detailCard}>
              <View style={styles.projectRenameHead}>
                <ProjectIcon project={{ ...project, name: projectName }} />
                <View style={styles.projectTitleBox}>
                  <Text numberOfLines={1} style={styles.company}>{project.company}</Text>
                  <Text numberOfLines={2} style={styles.taskTitle}>{projectName}</Text>
                </View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="create-outline" size={19} color="#7a8088" />
                  <TextInput
                    autoCapitalize="sentences"
                    onChangeText={setProjectNameDraft}
                    placeholder="Nombre del proyecto"
                    placeholderTextColor="#9aa0a8"
                    style={styles.input}
                    value={projectNameDraft}
                  />
                </View>
              </View>
              <Pressable
                disabled={renaming}
                onPress={saveProjectName}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || renaming) && styles.pressed,
                ]}
              >
                {renaming ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Guardar nombre</Text>
                    <Ionicons name="checkmark" size={21} color="#111" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setCreateOpen(false)} visible={createOpen}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setCreateOpen(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color="#111" />
            </Pressable>
            <Text style={styles.modalTitle}>Crear tarea</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <TaskFormFields
              attachments={newTaskAttachments}
              attachmentsDisabled={saving}
              description={description}
              dueDate={dueDate}
              members={members}
              onDescriptionChange={setDescription}
              onDueDateChange={setDueDate}
              onPickAttachments={pickNewTaskAttachments}
              onRemoveAttachment={(index) =>
                setNewTaskAttachments((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              onOwnerIdsChange={setOwnerIds}
              onPhaseIndexChange={setPhaseIndex}
              onPriorityChange={setPriority}
              onStatusChange={setNewStatus}
              onTagChange={setTag}
              onTitleChange={setTitle}
              ownerIds={ownerIds}
              phaseIndex={phaseIndex}
              phases={phases}
              priority={priority}
              status={newStatus}
              statusLabel="Estado inicial"
              tag={tag}
              title={title}
            />

            <Pressable
              disabled={saving}
              onPress={saveTask}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || saving) && styles.pressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#111" />
              ) : (
                <>
                  <Text style={styles.primaryText}>Crear tarea</Text>
                  <Ionicons name="checkmark" size={21} color="#111" />
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const colors = task.isOverdue
    ? { bg: "#fee4e2", fg: "#b42318" }
    : task.isDone
      ? { bg: "#dcfae6", fg: "#067647" }
      : { bg: "#eef2f6", fg: "#344054" };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.taskRow, pressed && styles.cardPressed]}>
      <View style={styles.taskRowTop}>
        <View style={[styles.taskStatusDot, { backgroundColor: colors.fg }]} />
        <View style={styles.taskTitleBox}>
          <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
          <Text numberOfLines={1} style={styles.taskMeta}>{task.phaseName}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.bg }]}>
          <Text style={[styles.chipText, { color: colors.fg }]}>
            {task.isOverdue ? "Atrasada" : task.statusLabel}
          </Text>
        </View>
      </View>
      {task.description ? (
        <Text numberOfLines={3} style={styles.taskDescription}>{task.description}</Text>
      ) : null}
      <View style={styles.taskFooter}>
        <Text numberOfLines={1} style={styles.taskMeta}>
          {task.owners.length > 0
            ? task.owners.map((owner) => owner.name).join(", ")
            : "Sin encargado"}
        </Text>
        <Text style={styles.taskMeta}>{task.dueDate}</Text>
      </View>
    </Pressable>
  );
}

function TaskDetailModal({
  user,
  taskId,
  phases,
  members,
  onClose,
}: {
  user: SessionUser;
  taskId: Id<"tareas"> | null;
  phases: ProjectPhase[];
  members: ProjectMember[];
  onClose: () => void;
}) {
  const detail = useQuery(
    api.mobile.getTaskDetail,
    taskId ? { profileId: user.id, taskId } : "skip",
  ) as TaskDetail | null | undefined;
  const workSummary = useQuery(
    (api as any).mobile.getWorkSummary,
    taskId ? { profileId: user.id, limit: 5 } : "skip",
  ) as WorkSummary | undefined;
  const addComment = useMutation(api.comentarioTareas.createComentarioTarea);
  const generateUploadUrl = useMutation((api as any).mobile.generateMobileUploadUrl);
  const addTaskAttachments = useMutation(api.tareas.addAdjuntosToTarea);
  const removeTaskAttachment = useMutation(api.tareas.removeAdjuntoFromTarea);
  const updateTask = useMutation(api.mobile.updateProjectTask);
  const startTimer = useMutation((api as any).mobile.startTaskTimer);
  const pauseTimer = useMutation((api as any).mobile.pauseTaskTimer);
  const stopTimer = useMutation((api as any).mobile.stopTaskTimer);
  const [comment, setComment] = useState("");
  const [commentAttachments, setCommentAttachments] = useState<PickedAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<TaskStatus | null>(null);
  const [timerAction, setTimerAction] = useState<"start" | "pause" | "stop" | null>(null);
  const [uploadingTaskAttachments, setUploadingTaskAttachments] = useState(false);
  const [removingTaskAttachmentId, setRemovingTaskAttachmentId] =
    useState<Id<"_storage"> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("pendiente");
  const [editPriority, setEditPriority] = useState<TaskPriority | null>(null);
  const [editTag, setEditTag] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPhaseIndex, setEditPhaseIndex] = useState<number | null>(null);
  const [editOwnerIds, setEditOwnerIds] = useState<Id<"profile">[]>([]);

  useEffect(() => {
    if (!taskId) {
      setComment("");
      setCommentAttachments([]);
      setEditOpen(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!editOpen || detail == null) return;
    const currentPhase = phases.find((phase) => phase.name === detail.phaseName);
    setEditTitle(detail.title);
    setEditDescription(detail.description ?? "");
    setEditStatus(detail.status);
    setEditPriority(detail.priority);
    setEditTag(detail.tag ?? "");
    setEditDueDate(detail.dueDate === "Sin fecha" ? "" : detail.dueDate);
    setEditPhaseIndex(detail.phaseIndex ?? currentPhase?.index ?? null);
    setEditOwnerIds(detail.owners.map((owner) => owner.id));
  }, [detail, editOpen, phases]);

  const pickCommentAttachments = useCallback(async () => {
    try {
      const nextAttachments = await pickAttachments();
      if (nextAttachments.length === 0) return;
      setCommentAttachments((current) => [...current, ...nextAttachments]);
    } catch (error) {
      Alert.alert(
        "No se pudo seleccionar el archivo",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    }
  }, []);

  const send = useCallback(async () => {
    if (!taskId || (!comment.trim() && commentAttachments.length === 0)) return;
    setSending(true);
    try {
      const uploaded =
        commentAttachments.length > 0
          ? await uploadPickedAttachments(commentAttachments, () =>
              generateUploadUrl({ profileId: user.id }),
            )
          : { names: [], storageIds: [] };

      await addComment({
        adjuntoNombres: uploaded.names.length > 0 ? uploaded.names : undefined,
        adjuntos: uploaded.storageIds.length > 0 ? uploaded.storageIds : undefined,
        autorId: user.id,
        contenido: comment.trim() || "Adjuntos",
        tareaId: taskId,
      });
      setComment("");
      setCommentAttachments([]);
    } catch (error) {
      Alert.alert(
        "No se pudo comentar",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSending(false);
    }
  }, [addComment, comment, commentAttachments, generateUploadUrl, taskId, user.id]);

  const addAttachmentsToTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const attachments = await pickAttachments();
      if (attachments.length === 0) return;

      setUploadingTaskAttachments(true);
      const uploaded = await uploadPickedAttachments(attachments, () =>
        generateUploadUrl({ profileId: user.id }),
      );
      await addTaskAttachments({
        adjuntoNombres: uploaded.names,
        adjuntos: uploaded.storageIds,
        tareaId: taskId,
      });
    } catch (error) {
      Alert.alert(
        "No se pudieron subir los adjuntos",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setUploadingTaskAttachments(false);
    }
  }, [addTaskAttachments, generateUploadUrl, taskId, user.id]);

  const removeAttachmentFromTask = useCallback(
    async (attachmentId: Id<"_storage">) => {
      if (!taskId) return;
      setRemovingTaskAttachmentId(attachmentId);
      try {
        await removeTaskAttachment({
          adjuntoId: attachmentId,
          tareaId: taskId,
        });
      } catch (error) {
        Alert.alert(
          "No se pudo quitar el adjunto",
          error instanceof Error ? error.message : "Intenta de nuevo.",
        );
      } finally {
        setRemovingTaskAttachmentId(null);
      }
    },
    [removeTaskAttachment, taskId],
  );

  const saveEdit = useCallback(async () => {
    if (!taskId || !editTitle.trim()) {
      Alert.alert("Falta título", "Ingresa el nombre de la tarea.");
      return;
    }

    setSavingEdit(true);
    try {
      await updateTask({
        description: editDescription.trim(),
        dueDate: editDueDate.trim() || undefined,
        ownerIds: editOwnerIds,
        phaseIndex: editPhaseIndex ?? undefined,
        priority: editPriority ?? undefined,
        profileId: user.id,
        status: editStatus,
        tag: editTag.trim(),
        taskId,
        title: editTitle.trim(),
      });
      setEditOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo actualizar la tarea",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSavingEdit(false);
    }
  }, [
    editDescription,
    editDueDate,
    editOwnerIds,
    editPhaseIndex,
    editPriority,
    editStatus,
    editTag,
    editTitle,
    taskId,
    updateTask,
    user.id,
  ]);

  const changeStatus = useCallback(
    async (status: TaskStatus) => {
      if (!taskId || detail == null || detail.status === status) return;
      setUpdatingStatus(status);
      try {
        await updateTask({
          profileId: user.id,
          taskId,
          status,
        });
      } catch (error) {
        Alert.alert(
          "No se pudo cambiar el estado",
          error instanceof Error ? error.message : "Intenta de nuevo.",
        );
      } finally {
        setUpdatingStatus(null);
      }
    },
    [detail, taskId, updateTask, user.id],
  );

  const activeForThisTask = Boolean(
    taskId && workSummary?.activeTimer?.taskId === taskId,
  );
  const timerMode = activeForThisTask ? workSummary?.activeTimer?.mode : null;
  const runTimerAction = useCallback(
    async (action: "start" | "pause" | "stop") => {
      if (!taskId) return;
      setTimerAction(action);
      try {
        const fn = action === "start" ? startTimer : action === "pause" ? pauseTimer : stopTimer;
        await fn({ profileId: user.id, taskId });
      } catch (error) {
        Alert.alert("No se pudo actualizar el timer", error instanceof Error ? error.message : "Intenta de nuevo.");
      } finally {
        setTimerAction(null);
      }
    },
    [pauseTimer, startTimer, stopTimer, taskId, user.id],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={taskId != null}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
          <Text style={styles.modalTitle}>Detalle de tarea</Text>
          {detail ? (
            <Pressable onPress={() => setEditOpen(true)} style={styles.backButton}>
              <Ionicons name="create-outline" size={22} color="#111" />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {detail === undefined ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#111" />
            <Text style={styles.stateText}>Cargando tarea...</Text>
          </View>
        ) : detail === null ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>No se pudo abrir</Text>
            <Text style={styles.stateText}>La tarea no existe o no tienes acceso.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.detailCard}>
              <Text style={styles.detailTaskTitle}>{detail.title}</Text>
              <Text style={styles.taskMeta}>{detail.project.name} · {detail.phaseName}</Text>
              {detail.description ? (
                <Text style={styles.taskDescription}>{detail.description}</Text>
              ) : null}
              <View style={styles.infoGrid}>
                <InfoPill label="Prioridad" value={detail.priority ?? "Sin prioridad"} />
                <InfoPill label="Etiqueta" value={detail.tag ?? "Sin etiqueta"} />
                <InfoPill label="Entrega" value={detail.dueDate} />
              </View>
              <View style={styles.timerBox}>
                <View style={styles.projectTitleBox}>
                  <Text style={styles.sectionTitle}>Timer</Text>
                  <Text style={styles.taskMeta}>
                    {activeForThisTask
                      ? `${timerMode === "running" ? "Corriendo" : "Pausado"} · ${workSummary?.activeTimer?.workedLabel ?? "0 min"}`
                      : "Sin timer activo en esta tarea"}
                  </Text>
                </View>
                <View style={styles.inlineActions}>
                  <Pressable
                    disabled={timerAction != null}
                    onPress={() => runTimerAction("start")}
                    style={styles.smallActionButton}
                  >
                    {timerAction === "start" ? <ActivityIndicator color="#111" /> : <Ionicons name="play" size={17} color="#111" />}
                    <Text style={styles.smallActionText}>{activeForThisTask ? "Reanudar" : "Iniciar"}</Text>
                  </Pressable>
                  {activeForThisTask ? (
                    <>
                      <Pressable
                        disabled={timerAction != null || timerMode !== "running"}
                        onPress={() => runTimerAction("pause")}
                        style={styles.smallActionButton}
                      >
                        {timerAction === "pause" ? <ActivityIndicator color="#111" /> : <Ionicons name="pause" size={17} color="#111" />}
                        <Text style={styles.smallActionText}>Pausar</Text>
                      </Pressable>
                      <Pressable
                        disabled={timerAction != null}
                        onPress={() => runTimerAction("stop")}
                        style={styles.smallActionButton}
                      >
                        {timerAction === "stop" ? <ActivityIndicator color="#111" /> : <Ionicons name="stop" size={17} color="#111" />}
                        <Text style={styles.smallActionText}>Detener</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
              <Text style={styles.sectionTitle}>Estado</Text>
              <View style={styles.statusGrid}>
                {TASK_STATUS_OPTIONS.map((item) => {
                  const active = detail.status === item.key;
                  const savingThis = updatingStatus === item.key;
                  return (
                    <Pressable
                      disabled={updatingStatus != null}
                      key={item.key}
                      onPress={() => changeStatus(item.key)}
                      style={[
                        styles.statusOption,
                        active && styles.statusOptionActive,
                        savingThis && styles.pressed,
                      ]}
                    >
                      {savingThis ? (
                        <ActivityIndicator color={active ? "#fff" : "#111"} />
                      ) : (
                        <Text
                          style={[
                            styles.statusOptionText,
                            active && styles.statusOptionTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.sectionTitle}>Encargados</Text>
              <Text style={styles.stateText}>
                {detail.owners.length > 0
                  ? detail.owners.map((owner) => owner.name).join(", ")
                  : "Sin encargados"}
              </Text>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Adjuntos</Text>
                <Pressable
                  disabled={uploadingTaskAttachments}
                  onPress={addAttachmentsToTask}
                  style={[styles.smallActionButton, uploadingTaskAttachments && styles.pressed]}
                >
                  {uploadingTaskAttachments ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <>
                      <Ionicons name="attach" size={17} color="#111" />
                      <Text style={styles.smallActionText}>Adjuntar</Text>
                    </>
                  )}
                </Pressable>
              </View>
              {detail.attachments.length === 0 ? (
                <Text style={styles.stateText}>Sin adjuntos.</Text>
              ) : (
                detail.attachments.map((attachment, index) => {
                  const attachmentId = taskAttachmentId(attachment);
                  return (
                    <View key={`${attachment.name}-${index}`} style={styles.attachmentRow}>
                      <Ionicons name="document-attach-outline" size={18} color="#667085" />
                      <Text numberOfLines={1} style={styles.attachmentName}>
                        {attachment.name}
                      </Text>
                      {attachmentId ? (
                        <Pressable
                          disabled={removingTaskAttachmentId != null}
                          onPress={() => removeAttachmentFromTask(attachmentId)}
                          style={styles.inlineIconButton}
                        >
                          {removingTaskAttachmentId === attachmentId ? (
                            <ActivityIndicator color="#111" />
                          ) : (
                            <Ionicons name="close" size={17} color="#111" />
                          )}
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Comentarios</Text>
              {detail.comments.length === 0 ? (
                <Text style={styles.stateText}>Aún no hay comentarios.</Text>
              ) : (
                detail.comments.map((item) => (
                  <View key={item.id} style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>
                      {item.authorName} · {item.createdLabel}
                    </Text>
                    <Text style={styles.commentText}>{item.content}</Text>
                    {item.attachmentNames.length > 0 ? (
                      <View style={styles.commentAttachmentList}>
                        {item.attachmentNames.map((name, index) => (
                          <View key={`${item.id}-${name}-${index}`} style={styles.commentAttachment}>
                            <Ionicons name="document-outline" size={15} color="#667085" />
                            <Text numberOfLines={1} style={styles.commentAttachmentText}>
                              {name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              {commentAttachments.length > 0 ? (
                <View style={styles.selectedAttachments}>
                  {commentAttachments.map((attachment, index) => (
                    <View key={`${attachment.uri}-${index}`} style={styles.selectedAttachment}>
                      <Ionicons name="document-attach-outline" size={16} color="#667085" />
                      <View style={styles.selectedAttachmentTextBox}>
                        <Text numberOfLines={1} style={styles.attachmentName}>
                          {attachment.name}
                        </Text>
                        {attachment.size ? (
                          <Text style={styles.attachmentMeta}>{formatFileSize(attachment.size)}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        disabled={sending}
                        onPress={() =>
                          setCommentAttachments((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        style={styles.inlineIconButton}
                      >
                        <Ionicons name="close" size={17} color="#111" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.commentComposer}>
                <Pressable
                  disabled={sending}
                  onPress={pickCommentAttachments}
                  style={[styles.sendButton, sending && styles.pressed]}
                >
                  <Ionicons name="attach" size={20} color="#111" />
                </Pressable>
                <TextInput
                  multiline
                  onChangeText={setComment}
                  placeholder="Escribe un comentario"
                  placeholderTextColor="#9aa0a8"
                  style={styles.commentInput}
                  value={comment}
                />
                <Pressable
                  disabled={sending || (!comment.trim() && commentAttachments.length === 0)}
                  onPress={send}
                  style={[
                    styles.sendButton,
                    (sending || (!comment.trim() && commentAttachments.length === 0)) &&
                      styles.pressed,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <Ionicons name="send" size={19} color="#111" />
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}

        <Modal animationType="slide" onRequestClose={() => setEditOpen(false)} visible={editOpen}>
          <SafeAreaView style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setEditOpen(false)} style={styles.backButton}>
                <Ionicons name="close" size={24} color="#111" />
              </Pressable>
              <Text style={styles.modalTitle}>Editar tarea</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <TaskFormFields
                description={editDescription}
                dueDate={editDueDate}
                members={members}
                onDescriptionChange={setEditDescription}
                onDueDateChange={setEditDueDate}
                onOwnerIdsChange={setEditOwnerIds}
                onPhaseIndexChange={setEditPhaseIndex}
                onPriorityChange={setEditPriority}
                onStatusChange={setEditStatus}
                onTagChange={setEditTag}
                onTitleChange={setEditTitle}
                ownerIds={editOwnerIds}
                phaseIndex={editPhaseIndex}
                phases={phases}
                priority={editPriority}
                status={editStatus}
                tag={editTag}
                title={editTitle}
              />

              <Pressable
                disabled={savingEdit}
                onPress={saveEdit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || savingEdit) && styles.pressed,
                ]}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>Guardar cambios</Text>
                    <Ionicons name="checkmark" size={21} color="#111" />
                  </>
                )}
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function NotificationsModal({
  visible,
  notifications,
  onClose,
  onOpenLinked,
}: {
  visible: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onOpenLinked: (notification: NotificationItem) => void | Promise<void>;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
          <Text style={styles.modalTitle}>Notificaciones</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {notifications.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="notifications-off-outline" size={34} color="#68707b" />
              <Text style={styles.emptyTitle}>Sin notificaciones</Text>
              <Text style={styles.stateText}>No hay novedades por ahora.</Text>
            </View>
          ) : (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onOpenLinked(item)}
                style={({ pressed }) => [
                  styles.notificationCard,
                  !item.read && styles.notificationUnread,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.notificationTop}>
                  <Text numberOfLines={2} style={styles.notificationTitle}>{item.title}</Text>
                  {!item.read ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text numberOfLines={3} style={styles.taskDescription}>{item.message}</Text>
                <Text style={styles.taskMeta}>
                  {item.projectName ?? "Sin proyecto"} · {item.createdLabel}
                </Text>
                {item.projectId || item.taskId ? (
                  <Text style={styles.notificationLink}>Abrir enlace</Text>
                ) : null}
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Root({ authClient }: { authClient: ConvexReactClient }) {
  const { user, loading, login, logout } = useSession();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#f6de39" />
      </View>
    );
  }

  return user ? (
    <Dashboard onLogout={logout} user={user} />
  ) : (
    <LoginScreen authClient={authClient} onLogin={login} />
  );
}

export default function App() {
  if (!convex) {
    return (
      <SafeAreaProvider>
        <View style={styles.boot}>
          <Text style={styles.bootTitle}>Configuración incompleta</Text>
          <Text style={styles.bootText}>Falta EXPO_PUBLIC_CONVEX_URL en este build.</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConvexProvider client={convex}>
        <Root authClient={convex} />
      </ConvexProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { alignItems: "center", backgroundColor: "#111", flex: 1, justifyContent: "center" },
  bootText: { color: "#d0d5dd", fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: "center" },
  bootTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  loginRoot: { flex: 1 },
  loginContent: { flex: 1, justifyContent: "center", padding: 18, paddingVertical: 34 },
  loginCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    gap: 22,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
  },
  eyebrow: { color: "#817329", fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  loginTitle: { color: "#111", fontSize: 34, fontWeight: "900", lineHeight: 39, marginTop: 8 },
  loginSubtitle: { color: "#555b63", fontSize: 15, lineHeight: 22, marginTop: 8 },
  field: { gap: 8 },
  label: { color: "#25282d", fontSize: 13, fontWeight: "800" },
  inputShell: {
    alignItems: "center",
    backgroundColor: "#f7f7f5",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: 14,
  },
  input: { color: "#111", flex: 1, fontSize: 16, paddingHorizontal: 10 },
  iconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
  },
  pressed: { opacity: 0.7 },
  primaryText: { color: "#111", fontSize: 16, fontWeight: "800" },
  dashboard: { backgroundColor: "#f6f5ef", flex: 1 },
  dashboardContent: { padding: 18, paddingBottom: 32 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  headerActions: { flexDirection: "row", gap: 8 },
  hello: { color: "#111", fontSize: 26, fontWeight: "800" },
  subhead: { color: "#65605a", fontSize: 15, marginTop: 3 },
  logout: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#f04438",
    borderRadius: 999,
    minWidth: 17,
    paddingHorizontal: 4,
    position: "absolute",
    right: -3,
    top: -4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  summary: { backgroundColor: "#111", borderRadius: 8, flexDirection: "row", marginBottom: 18, padding: 14 },
  summaryItem: { flex: 1, gap: 4 },
  summaryValue: { color: "#f6de39", fontSize: 22, fontWeight: "800", textAlign: "center" },
  summaryLabel: { color: "#ebe7d9", fontSize: 11, fontWeight: "700", textAlign: "center" },
  segmented: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    padding: 5,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
  },
  segmentButtonActive: { backgroundColor: "#111" },
  segmentText: { color: "#475467", fontSize: 13, fontWeight: "700" },
  segmentTextActive: { color: "#fff" },
  segmentCount: { color: "#667085", fontSize: 12, fontWeight: "700" },
  searchShell: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
    minHeight: 50,
    paddingHorizontal: 13,
  },
  searchInput: { color: "#111", flex: 1, fontSize: 15 },
  clearButton: { alignItems: "center", height: 32, justifyContent: "center", width: 32 },
  tabs: { marginBottom: 14 },
  tabsContent: { gap: 8, paddingRight: 6 },
  tabButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  tabButtonActive: { backgroundColor: "#111", borderColor: "#111" },
  tabText: { color: "#475467", fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  tabCount: { color: "#667085", fontSize: 12, fontWeight: "700" },
  stateCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 8, gap: 10, padding: 28 },
  emptyTitle: { color: "#111", fontSize: 18, fontWeight: "800" },
  stateText: { color: "#667085", fontSize: 14, lineHeight: 20, textAlign: "center" },
  panelStack: { gap: 14 },
  list: { gap: 14 },
  projectToolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  projectCard: { backgroundColor: "#fff", borderColor: "#ece7da", borderRadius: 8, borderWidth: 1, gap: 14, padding: 16 },
  cardPressed: { opacity: 0.72 },
  projectHead: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  projectOpenArea: { alignItems: "flex-start", flex: 1, flexDirection: "row", gap: 12, minWidth: 0 },
  projectIcon: { alignItems: "center", backgroundColor: "#f6de39", borderRadius: 8, height: 44, justifyContent: "center", overflow: "hidden", width: 44 },
  projectIconImage: { height: "100%", resizeMode: "cover", width: "100%" },
  projectIconText: { color: "#111", fontSize: 20, fontWeight: "800" },
  projectTitleBox: { flex: 1, minWidth: 0 },
  company: { color: "#7b7264", fontSize: 12, fontWeight: "700", marginBottom: 3 },
  projectName: { color: "#111", fontSize: 18, fontWeight: "800", lineHeight: 22 },
  projectCardActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  favoriteBadge: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  expandButton: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  projectDetails: { gap: 12 },
  projectRenameHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "700" },
  phaseChip: {
    backgroundColor: "#f6de39",
    borderRadius: 8,
    maxWidth: 126,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  phaseChipText: { color: "#111", fontSize: 12, fontWeight: "800" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  metaText: { color: "#475467", flex: 1, fontSize: 14, fontWeight: "700" },
  progressTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#667085", fontSize: 13, fontWeight: "700" },
  progressNumber: { color: "#111", fontSize: 14, fontWeight: "800" },
  track: { backgroundColor: "#eee9dc", borderRadius: 999, height: 9, overflow: "hidden" },
  fill: { backgroundColor: "#f6de39", borderRadius: 999, height: 9 },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: "#f8f7f2", borderRadius: 8, flex: 1, gap: 4, minHeight: 78, padding: 10 },
  metricLabel: { color: "#667085", fontSize: 11, fontWeight: "700" },
  metricValue: { color: "#111", fontSize: 13, fontWeight: "800" },
  linkButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#f6de39", borderRadius: 8, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  linkButtonText: { color: "#111", fontSize: 13, fontWeight: "800" },
  detailHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    marginTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  detailTitleBox: { flex: 1, minWidth: 0 },
  detailTitle: { color: "#111", fontSize: 22, fontWeight: "800", lineHeight: 27 },
  projectMini: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    gap: 9,
    marginBottom: 14,
    padding: 16,
  },
  projectSummaryTop: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  projectMiniLabel: { color: "#667085", fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  projectMiniValue: { color: "#111", fontSize: 17, fontWeight: "800" },
  projectPercentPill: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  projectPercentText: { color: "#111", fontSize: 14, fontWeight: "800" },
  projectTabs: { marginBottom: 14 },
  projectTabsContent: { gap: 8, paddingRight: 6 },
  projectTabButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 11,
  },
  projectTabButtonActive: { backgroundColor: "#f6de39", borderColor: "#111" },
  projectTabText: { color: "#475467", fontSize: 13, fontWeight: "700" },
  projectTabTextActive: { color: "#111" },
  projectTabCount: { color: "#667085", fontSize: 12, fontWeight: "700" },
  taskSectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  phaseList: { gap: 8 },
  phaseRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  phaseRowActive: { backgroundColor: "#fff7c2", borderColor: "#f6de39", borderWidth: 1 },
  taskRow: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  taskRowTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  taskStatusDot: { borderRadius: 999, height: 10, marginTop: 7, width: 10 },
  taskTitleBox: { flex: 1, minWidth: 0 },
  taskTitle: { color: "#111", fontSize: 16, fontWeight: "800", lineHeight: 20 },
  taskDescription: { color: "#4f5865", fontSize: 13, lineHeight: 19 },
  taskFooter: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  taskMeta: { color: "#667085", flexShrink: 1, fontSize: 12, fontWeight: "600" },
  detailCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  detailTaskTitle: { color: "#111", fontSize: 22, fontWeight: "800", lineHeight: 27 },
  ticketCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  timerBox: {
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    gap: 12,
    padding: 12,
  },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bigNumber: { color: "#111", fontSize: 30, fontWeight: "800" },
  logRow: {
    alignItems: "center",
    borderBottomColor: "#ece7da",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoPill: {
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    gap: 4,
    minHeight: 68,
    padding: 10,
    width: "48%",
  },
  sectionTitle: { color: "#111", fontSize: 16, fontWeight: "800", marginTop: 4 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  smallActionButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
  },
  smallActionText: { color: "#111", fontSize: 12, fontWeight: "800" },
  secondarySmallButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 38,
  },
  projectIconPicker: {
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  projectIconLarge: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 8,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 58,
  },
  projectIconLargeText: { color: "#111", fontSize: 26, fontWeight: "800" },
  projectIconPickerBody: { flex: 1, gap: 10, minWidth: 0 },
  iconSwatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  iconSwatch: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  iconSwatchActive: { backgroundColor: "#fff7c2", borderColor: "#111" },
  iconSwatchText: { fontSize: 17 },
  infoList: { gap: 8 },
  infoRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  infoTitle: { color: "#111", flexShrink: 1, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  activeLabel: {
    backgroundColor: "#111",
    borderRadius: 6,
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  memberRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    padding: 10,
  },
  memberAvatar: {
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  memberInitial: { color: "#fff", fontSize: 14, fontWeight: "800" },
  progressBlock: { gap: 9 },
  projectNote: { color: "#4f5865", fontSize: 13, lineHeight: 19 },
  attachmentRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  attachmentName: { color: "#111", flex: 1, fontSize: 13, fontWeight: "700" },
  attachmentMeta: { color: "#667085", fontSize: 11, fontWeight: "600" },
  inlineIconButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  inlineIconButtonActive: { backgroundColor: "#fff7c2", borderColor: "#111" },
  phaseEditorList: { gap: 10 },
  phaseEditorRow: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 10,
  },
  phaseMoveButtons: { gap: 6 },
  phaseEditorFields: { flex: 1, gap: 8, minWidth: 0 },
  phaseRowActions: { gap: 6 },
  compactInput: {
    backgroundColor: "#f7f7f5",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111",
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 11,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryButtonText: { color: "#111", fontSize: 14, fontWeight: "800" },
  commentBubble: {
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    gap: 5,
    padding: 12,
  },
  commentAuthor: { color: "#667085", fontSize: 12, fontWeight: "700" },
  commentText: { color: "#111", fontSize: 14, lineHeight: 20 },
  commentAttachmentList: { gap: 6, marginTop: 4 },
  commentAttachment: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 9,
  },
  commentAttachmentText: { color: "#475467", flex: 1, fontSize: 12, fontWeight: "700" },
  selectedAttachments: { gap: 8, marginTop: 4 },
  selectedAttachment: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  selectedAttachmentTextBox: { flex: 1, minWidth: 0 },
  commentComposer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 9,
    marginTop: 4,
  },
  commentInput: {
    backgroundColor: "#fff",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111",
    flex: 1,
    fontSize: 14,
    maxHeight: 110,
    minHeight: 48,
    padding: 12,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  notificationCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  notificationUnread: { borderColor: "#f6de39", borderWidth: 2 },
  notificationTop: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  notificationTitle: { color: "#111", flex: 1, fontSize: 16, fontWeight: "800", lineHeight: 20 },
  unreadDot: { backgroundColor: "#f04438", borderRadius: 999, height: 9, marginTop: 5, width: 9 },
  notificationLink: { color: "#111", fontSize: 13, fontWeight: "800", marginTop: 2 },
  modalRoot: { backgroundColor: "#f6f5ef", flex: 1 },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalTitle: { color: "#111", flex: 1, fontSize: 20, fontWeight: "800", textAlign: "center" },
  headerSpacer: { height: 44, width: 44 },
  modalContent: { gap: 18, padding: 18, paddingBottom: 34 },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 4,
  },
  modalSaveButton: { flex: 1 },
  textarea: {
    backgroundColor: "#fff",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111",
    fontSize: 15,
    minHeight: 120,
    padding: 14,
    textAlignVertical: "top",
  },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  dropdownShell: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 13,
  },
  dropdownValue: { color: "#475467", flex: 1, fontSize: 15, fontWeight: "700" },
  dropdownClear: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  dropdownMenu: {
    backgroundColor: "#fff",
    borderColor: "#e6e2d6",
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    marginTop: 8,
    padding: 6,
  },
  dropdownOption: {
    alignItems: "center",
    borderRadius: 6,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  dropdownOptionActive: { backgroundColor: "#fff7c2" },
  dropdownOptionText: { color: "#475467", flex: 1, fontSize: 14, fontWeight: "700" },
  dropdownOptionTextActive: { color: "#111" },
  statusOption: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statusOptionActive: { backgroundColor: "#111", borderColor: "#111" },
  statusOptionText: { color: "#475467", fontSize: 13, fontWeight: "700" },
  statusOptionTextActive: { color: "#fff" },
});
