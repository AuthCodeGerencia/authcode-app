import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ConvexProvider, useMutation, useQuery } from "convex/react";
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
import {
  endTimerLiveActivity,
  startOrUpdateTimerLiveActivity,
  type TimerLiveActivityProps,
} from "./src/timerLiveActivity";

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
type DashboardTab = "proyectos" | "tareas" | "tickets" | "horas" | "briefs";

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
  attachmentsCount: number;
  messagesCount: number;
  historyCount: number;
};

type TicketDetail = {
  id: Id<"tickets">;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  projectId: Id<"proyectos"> | null;
  projectName: string;
  attachments: Array<{ id: Id<"_storage">; name: string; url: string | null }>;
  history: Array<{ action: string; authorId: string; note: string; createdLabel: string }>;
  messages: Array<{
    id: Id<"messages">;
    content: string;
    authorName: string;
    createdLabel: string;
    attachments: Array<{ id: Id<"_storage">; name: string; url: string | null }>;
  }>;
};

type BriefItem = {
  id: Id<"briefDesarrolloWebSubmissions">;
  title: string;
  summary: string;
  projectId: Id<"proyectos"> | null;
  projectName: string;
  companyName: string;
  via: string;
  submittedBy: string;
  createdLabel: string;
};

type AssignedTaskItem = {
  id: Id<"tareas">;
  title: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  priority: TaskPriority | null;
  tag: string | null;
  dueDate: string;
  dueAt: number | null;
  projectId: Id<"proyectos">;
  projectName: string;
  projectCompany: string;
  projectPhase: string;
  assignedToMe: boolean;
  visibleToMe: boolean;
  isDone: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
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
  { key: "open", label: "Abierto" },
  { key: "in_progress", label: "En proceso" },
  { key: "closed", label: "Cerrado" },
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

function ticketStatusLabel(status: string) {
  if (status === "open" || status === "abierto") return "Abierto";
  if (status === "in_progress" || status === "en_proceso") return "En proceso";
  if (status === "closed" || status === "cerrado" || status === "solved") return "Cerrado";
  return status;
}

function ticketStatusGroup(status: string) {
  if (status === "abierto") return "open";
  if (status === "en_proceso") return "in_progress";
  if (status === "cerrado" || status === "solved") return "closed";
  return status;
}

function timerLiveActivityProps(args: {
  taskId: Id<"tareas">;
  taskTitle: string;
  projectName: string;
  workedMs?: number;
  mode: "running" | "paused";
}): TimerLiveActivityProps {
  const now = Date.now();
  const workedMs = Math.max(0, args.workedMs ?? 0);
  return {
    accumulatedMs: workedMs,
    mode: args.mode,
    projectName: args.projectName,
    startedAt: now - workedMs,
    taskId: String(args.taskId),
    taskTitle: args.taskTitle,
    updatedAt: now,
  };
}

function formatDurationClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function useLiveWorkedMs(timer?: { mode: "running" | "paused"; workedMs: number } | null) {
  const [now, setNow] = useState(Date.now());
  const [base, setBase] = useState({ capturedAt: Date.now(), workedMs: timer?.workedMs ?? 0 });

  useEffect(() => {
    setBase({ capturedAt: Date.now(), workedMs: timer?.workedMs ?? 0 });
  }, [timer?.mode, timer?.workedMs]);

  useEffect(() => {
    if (timer?.mode !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer?.mode]);

  if (!timer) return 0;
  if (timer.mode !== "running") return timer.workedMs;
  return base.workedMs + Math.max(0, now - base.capturedAt);
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
  const currentPermissionStatus = currentPermissions as {
    granted?: boolean;
    status?: Notifications.PermissionStatus;
  };
  const finalPermissions = currentPermissionStatus.granted ||
    currentPermissionStatus.status === Notifications.PermissionStatus.GRANTED
    ? currentPermissions
    : await Notifications.requestPermissionsAsync();
  const finalPermissionStatus = finalPermissions as {
    granted?: boolean;
    status?: Notifications.PermissionStatus;
  };

  if (
    !finalPermissionStatus.granted &&
    finalPermissionStatus.status !== Notifications.PermissionStatus.GRANTED
  ) return null;

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
  const assignedTasksResult = useQuery((api as any).mobile.getAssignedTasks, {
    profileId: user.id,
    limit: 80,
  }) as { tasks: AssignedTaskItem[]; counts: { total: number; assigned: number; overdue: number; dueSoon: number } } | undefined;
  const briefsResult = useQuery((api as any).mobile.getBriefsOverview, {
    profileId: user.id,
    limit: 50,
  }) as { briefs: BriefItem[] } | undefined;
  const markNotificationRead = useMutation(api.mobile.markNotificationRead);
  const registerPushToken = useMutation((api as any).mobile.registerPushToken);
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
  const [tab, setTab] = useState<ProjectTab>("todos");
  const [mainTab, setMainTab] = useState<DashboardTab>("proyectos");
  const [selectedProject, setSelectedProject] = useState<{
    project: Project;
    taskId?: Id<"tareas">;
  } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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

  useEffect(() => {
    if (workResult === undefined) return;
    const activeTimer = workResult.activeTimer;
    if (!activeTimer) {
      const id = setTimeout(() => {
        endTimerLiveActivity().catch(() => {});
      }, 90000);
      return () => clearTimeout(id);
    }

    startOrUpdateTimerLiveActivity(
      timerLiveActivityProps({
        mode: activeTimer.mode,
        projectName: activeTimer.projectName,
        taskId: activeTimer.taskId,
        taskTitle: activeTimer.taskTitle,
        workedMs: activeTimer.workedMs,
      }),
    ).catch((error) => {
      console.warn("[live-activity] No se pudo sincronizar", error);
    });
  }, [
    workResult,
    workResult?.activeTimer?.mode,
    workResult?.activeTimer?.projectName,
    workResult?.activeTimer?.taskId,
    workResult?.activeTimer?.taskTitle,
    workResult?.activeTimer?.workedMs,
  ]);
  const projectTabs = useMemo(() => {
    const phases = [...new Set(projectsWithFavorites.map((project) => project.phase))];
    return [
      { key: "todos" as ProjectTab, label: "Todos", count: projectsWithFavorites.length },
      {
        key: "favoritos" as ProjectTab,
        label: "Favoritos",
        count: projectsWithFavorites.filter((project) => project.isFavorite).length,
      },
      ...phases.map((phase) => ({
        key: phase,
        label: phase,
        count: projectsWithFavorites.filter((project) => project.phase === phase).length,
      })),
    ];
  }, [projectsWithFavorites]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projectsWithFavorites.filter((project) => {
      const byTab =
        tab === "todos" || (tab === "favoritos" ? project.isFavorite : project.phase === tab);
      const bySearch =
        term.length === 0 ||
        project.name.toLowerCase().includes(term) ||
        project.company.toLowerCase().includes(term) ||
        project.phase.toLowerCase().includes(term);
      return byTab && bySearch;
    });
  }, [projectsWithFavorites, search, tab]);

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
    { key: "proyectos" as const, label: "Proy.", count: projectsWithFavorites.length },
    { key: "tareas" as const, label: "Tareas", count: assignedTasksResult?.counts.total ?? 0 },
    { key: "tickets" as const, label: "Tickets", count: ticketsResult?.tickets.length ?? 0 },
    { key: "horas" as const, label: "Horas", count: workResult?.logs.length ?? 0 },
    { key: "briefs" as const, label: "Briefs", count: briefsResult?.briefs.length ?? 0 },
  ];

  const openTaskFromAssigned = useCallback(
    (task: AssignedTaskItem) => {
      const project = projectsWithFavorites.find((item) => item.id === task.projectId) ?? {
        band: task.isOverdue ? "critical" as const : task.isDueSoon ? "risk" as const : "steady" as const,
        company: task.projectCompany,
        dueDate: task.dueDate,
        icon: null,
        id: task.projectId,
        name: task.projectName,
        percent: task.isDone ? 100 : 0,
        phase: task.projectPhase,
        status: task.isDone ? "Completado" : task.isOverdue ? "Atrasado" : "En curso",
        tasks: { total: 1, pending: task.isDone ? 0 : 1, overdue: task.isOverdue ? 1 : 0, dueSoon: task.isDueSoon ? 1 : 0 },
        url: null,
      };
      setSelectedProject({ project, taskId: task.id });
    },
    [projectsWithFavorites],
  );

  if (selectedProject) {
    return (
      <TasksScreen
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
        ) : mainTab === "tareas" ? (
          <AssignedTasksPanel
            counts={assignedTasksResult?.counts}
            onOpenTask={openTaskFromAssigned}
            tasks={assignedTasksResult?.tasks}
          />
        ) : mainTab === "tickets" ? (
          <TicketsPanel
            projects={projectsWithFavorites}
            tickets={ticketsResult?.tickets}
            user={user}
          />
        ) : mainTab === "horas" ? (
          <HoursPanel
            onOpenTask={(projectId, taskId) => {
              const project = projectsWithFavorites.find((item) => item.id === projectId);
              if (project) setSelectedProject({ project, taskId });
            }}
            summary={workResult}
            user={user}
          />
        ) : (
          <BriefsPanel
            briefs={briefsResult?.briefs}
            onOpenProject={(projectId) => {
              const project = projectsWithFavorites.find((item) => item.id === projectId);
              if (project) setSelectedProject({ project });
            }}
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

function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.projectCard, pressed && styles.cardPressed]}>
      <View style={styles.projectHead}>
        <View style={styles.projectIcon}>
          <Text style={styles.projectIconText}>{project.icon ?? "A"}</Text>
        </View>
        <View style={styles.projectTitleBox}>
          <Text numberOfLines={1} style={styles.company}>{project.company}</Text>
          <Text numberOfLines={2} style={styles.projectName}>{project.name}</Text>
        </View>
        {project.isFavorite ? (
          <View style={styles.favoriteBadge}>
            <Ionicons name="star" size={17} color="#111" />
          </View>
        ) : null}
      </View>

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
    </Pressable>
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

function AssignedTasksPanel({
  tasks,
  counts,
  onOpenTask,
}: {
  tasks?: AssignedTaskItem[];
  counts?: { total: number; assigned: number; overdue: number; dueSoon: number };
  onOpenTask: (task: AssignedTaskItem) => void;
}) {
  const [filter, setFilter] = useState<"todas" | "asignadas" | "atrasadas" | "semana">("todas");
  const filtered = useMemo(() => {
    const source = tasks ?? [];
    if (filter === "asignadas") return source.filter((task) => task.assignedToMe);
    if (filter === "atrasadas") return source.filter((task) => task.isOverdue);
    if (filter === "semana") return source.filter((task) => task.isDueSoon);
    return source;
  }, [filter, tasks]);

  if (tasks === undefined) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color="#111" />
        <Text style={styles.stateText}>Cargando tareas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.panelStack}>
      <View style={styles.summary}>
        <Summary label="Mías" value={counts?.assigned ?? 0} />
        <Summary label="Atrasadas" value={counts?.overdue ?? 0} />
        <Summary label="Semana" value={counts?.dueSoon ?? 0} />
      </View>

      <ScrollView
        contentContainerStyle={styles.tabsContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
      >
        {[
          { key: "todas" as const, label: "Todas", count: counts?.total ?? 0 },
          { key: "asignadas" as const, label: "Asignadas", count: counts?.assigned ?? 0 },
          { key: "atrasadas" as const, label: "Atrasadas", count: counts?.overdue ?? 0 },
          { key: "semana" as const, label: "Semana", count: counts?.dueSoon ?? 0 },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.tabButton, filter === item.key && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, filter === item.key && styles.tabTextActive]}>
              {item.label}
            </Text>
            <Text style={[styles.tabCount, filter === item.key && styles.tabTextActive]}>
              {item.count}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="checkbox-outline" size={34} color="#68707b" />
          <Text style={styles.emptyTitle}>Sin tareas</Text>
          <Text style={styles.stateText}>No hay tareas en este filtro.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => onOpenTask(task)}
              style={({ pressed }) => [styles.taskRow, pressed && styles.cardPressed]}
            >
              <View style={styles.taskRowTop}>
                <View style={[
                  styles.taskStatusDot,
                  { backgroundColor: task.isOverdue ? "#b42318" : task.isDone ? "#067647" : "#111" },
                ]} />
                <View style={styles.taskTitleBox}>
                  <Text numberOfLines={2} style={styles.taskTitle}>{task.title}</Text>
                  <Text numberOfLines={1} style={styles.taskMeta}>
                    {task.projectName} · {task.projectPhase}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: task.isOverdue ? "#fee4e2" : task.isDone ? "#dcfae6" : "#eef2f6" }]}>
                  <Text style={[styles.chipText, { color: task.isOverdue ? "#b42318" : task.isDone ? "#067647" : "#344054" }]}>
                    {task.isOverdue ? "Atrasada" : task.statusLabel}
                  </Text>
                </View>
              </View>
              {task.description ? (
                <Text numberOfLines={2} style={styles.taskDescription}>{task.description}</Text>
              ) : null}
              <View style={styles.taskFooter}>
                <Text numberOfLines={1} style={styles.taskMeta}>
                  {task.assignedToMe ? "Asignada a ti" : "Visible para ti"}
                </Text>
                <Text style={styles.taskMeta}>{task.dueDate}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
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
  const [selectedTicketId, setSelectedTicketId] = useState<Id<"tickets"> | null>(null);

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

  const isClosedStatus = (status: string) => ticketStatusGroup(status) === "closed";

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
            <Pressable key={ticket.id} onPress={() => setSelectedTicketId(ticket.id)} style={styles.ticketCard}>
              <View style={styles.projectHead}>
                <View style={styles.projectTitleBox}>
                  <Text numberOfLines={2} style={styles.taskTitle}>{ticket.title}</Text>
                  <Text numberOfLines={1} style={styles.taskMeta}>
                    {ticket.projectName} · {ticket.createdLabel}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: isClosedStatus(ticket.status) ? "#dcfae6" : "#fef0c7" }]}>
                  <Text style={[styles.chipText, { color: isClosedStatus(ticket.status) ? "#067647" : "#b54708" }]}>
                    {ticketStatusLabel(ticket.status)}
                  </Text>
                </View>
              </View>
              {ticket.description ? (
                <Text numberOfLines={3} style={styles.taskDescription}>{ticket.description}</Text>
              ) : null}
              <View style={styles.inlineActions}>
                <View style={styles.infoPill}>
                  <Text style={styles.metricLabel}>Mensajes</Text>
                  <Text style={styles.metricValue}>{ticket.messagesCount}</Text>
                </View>
                <View style={styles.infoPill}>
                  <Text style={styles.metricLabel}>Adjuntos</Text>
                  <Text style={styles.metricValue}>{ticket.attachmentsCount}</Text>
                </View>
              </View>
              <View style={styles.statusGrid}>
                {TICKET_STATUS_OPTIONS.map((item) => (
                  <Pressable
                    disabled={updatingId != null}
                    key={item.key}
                    onPress={() => changeStatus(ticket, item.key)}
                    style={[
                      styles.statusOption,
                      ticketStatusGroup(ticket.status) === item.key && styles.statusOptionActive,
                      updatingId === ticket.id && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      ticketStatusGroup(ticket.status) === item.key && styles.statusOptionTextActive,
                    ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
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

      <TicketDetailModal
        onClose={() => setSelectedTicketId(null)}
        ticketId={selectedTicketId}
        user={user}
      />
    </View>
  );
}

function TicketDetailModal({
  user,
  ticketId,
  onClose,
}: {
  user: SessionUser;
  ticketId: Id<"tickets"> | null;
  onClose: () => void;
}) {
  const detail = useQuery(
    (api as any).mobile.getTicketDetail,
    ticketId ? { profileId: user.id, ticketId } : "skip",
  ) as TicketDetail | null | undefined;
  const addMessage = useMutation((api as any).mobile.addMobileTicketMessage);
  const generateUploadUrl = useMutation((api as any).mobile.generateMobileUploadUrl);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setMessage("");
      setAttachments([]);
    }
  }, [ticketId]);

  const pickTicketAttachments = useCallback(async () => {
    try {
      const next = await pickAttachments();
      if (next.length > 0) setAttachments((current) => [...current, ...next]);
    } catch (error) {
      Alert.alert("No se pudo seleccionar", error instanceof Error ? error.message : "Intenta de nuevo.");
    }
  }, []);

  const send = useCallback(async () => {
    if (!ticketId || (!message.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      const uploaded =
        attachments.length > 0
          ? await uploadPickedAttachments(attachments, () => generateUploadUrl({ profileId: user.id }))
          : { names: [], storageIds: [] };
      await addMessage({
        attachments: uploaded.storageIds.length > 0 ? uploaded.storageIds : undefined,
        content: message.trim(),
        profileId: user.id,
        ticketId,
      });
      setMessage("");
      setAttachments([]);
    } catch (error) {
      Alert.alert("No se pudo responder", error instanceof Error ? error.message : "Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }, [addMessage, attachments, generateUploadUrl, message, ticketId, user.id]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={ticketId != null}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
          <Text numberOfLines={1} style={styles.modalTitle}>Ticket</Text>
          <View style={styles.headerSpacer} />
        </View>
        {detail === undefined ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#111" />
            <Text style={styles.stateText}>Cargando ticket...</Text>
          </View>
        ) : detail == null ? (
          <View style={styles.stateCard}>
            <Text style={styles.emptyTitle}>Ticket no disponible</Text>
            <Text style={styles.stateText}>No tienes acceso o ya no existe.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.detailCard}>
              <Text style={styles.detailTaskTitle}>{detail.title}</Text>
              <Text style={styles.taskMeta}>{detail.projectName} · {ticketStatusLabel(detail.status)} · {detail.priority}</Text>
              {detail.description ? <Text style={styles.taskDescription}>{detail.description}</Text> : null}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Adjuntos</Text>
              {detail.attachments.length === 0 ? (
                <Text style={styles.stateText}>Sin adjuntos.</Text>
              ) : (
                detail.attachments.map((attachment) => (
                  <Pressable
                    key={attachment.id}
                    disabled={!attachment.url}
                    onPress={() => attachment.url && Linking.openURL(attachment.url)}
                    style={styles.attachmentRow}
                  >
                    <Ionicons name="document-attach-outline" size={18} color="#667085" />
                    <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Conversación</Text>
              {detail.messages.length === 0 ? (
                <Text style={styles.stateText}>Sin mensajes todavía.</Text>
              ) : (
                detail.messages.map((item) => (
                  <View key={item.id} style={styles.commentBubble}>
                    <Text style={styles.commentAuthor}>{item.authorName} · {item.createdLabel}</Text>
                    <Text style={styles.commentText}>{item.content}</Text>
                    {item.attachments.map((attachment) => (
                      <Pressable
                        key={attachment.id}
                        disabled={!attachment.url}
                        onPress={() => attachment.url && Linking.openURL(attachment.url)}
                        style={styles.attachmentRow}
                      >
                        <Ionicons name="document-attach-outline" size={17} color="#667085" />
                        <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Responder</Text>
              <TextInput
                multiline
                onChangeText={setMessage}
                placeholder="Escribe un mensaje"
                placeholderTextColor="#9aa0a8"
                style={styles.textarea}
                value={message}
              />
              {attachments.map((attachment) => (
                <View key={`${attachment.uri}-${attachment.name}`} style={styles.attachmentRow}>
                  <Ionicons name="document-outline" size={18} color="#667085" />
                  <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                </View>
              ))}
              <View style={styles.inlineActions}>
                <Pressable onPress={pickTicketAttachments} style={styles.smallActionButton}>
                  <Ionicons name="attach" size={17} color="#111" />
                  <Text style={styles.smallActionText}>Adjuntar</Text>
                </Pressable>
                <Pressable disabled={sending} onPress={send} style={[styles.smallActionButton, sending && styles.pressed]}>
                  {sending ? <ActivityIndicator color="#111" /> : <Ionicons name="send" size={17} color="#111" />}
                  <Text style={styles.smallActionText}>Enviar</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function BriefsPanel({
  briefs,
  onOpenProject,
}: {
  briefs?: BriefItem[];
  onOpenProject: (projectId: Id<"proyectos">) => void;
}) {
  if (briefs === undefined) {
    return (
      <View style={styles.stateCard}>
        <ActivityIndicator color="#111" />
        <Text style={styles.stateText}>Cargando briefs...</Text>
      </View>
    );
  }

  if (briefs.length === 0) {
    return (
      <View style={styles.stateCard}>
        <Ionicons name="reader-outline" size={34} color="#68707b" />
        <Text style={styles.emptyTitle}>Sin briefs visibles</Text>
        <Text style={styles.stateText}>Aquí aparecerán los briefs ligados a tus proyectos.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panelStack}>
      {briefs.map((brief) => (
        <Pressable
          key={brief.id}
          disabled={!brief.projectId}
          onPress={() => brief.projectId && onOpenProject(brief.projectId)}
          style={styles.ticketCard}
        >
          <View style={styles.projectHead}>
            <View style={styles.projectIcon}>
              <Ionicons name="reader-outline" size={21} color="#111" />
            </View>
            <View style={styles.projectTitleBox}>
              <Text numberOfLines={1} style={styles.company}>{brief.companyName}</Text>
              <Text numberOfLines={2} style={styles.taskTitle}>{brief.title}</Text>
              <Text numberOfLines={1} style={styles.taskMeta}>
                {brief.projectName} · {brief.createdLabel}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: brief.via === "public" ? "#eef2f6" : "#dcfae6" }]}>
              <Text style={[styles.chipText, { color: brief.via === "public" ? "#344054" : "#067647" }]}>
                {brief.via === "public" ? "Cliente" : "Equipo"}
              </Text>
            </View>
          </View>
          {brief.summary ? (
            <Text numberOfLines={3} style={styles.taskDescription}>{brief.summary}</Text>
          ) : null}
          <Text style={styles.taskMeta}>Enviado por {brief.submittedBy}</Text>
        </Pressable>
      ))}
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
  const startTimer = useMutation((api as any).mobile.startTaskTimer);
  const pauseTimer = useMutation((api as any).mobile.pauseTaskTimer);
  const stopTimer = useMutation((api as any).mobile.stopTaskTimer);
  const [busy, setBusy] = useState<"start" | "pause" | "stop" | "live" | null>(null);

  const activeTaskId = summary?.activeTimer?.taskId;
  const activeWorkedMs = useLiveWorkedMs(summary?.activeTimer);
  const actOnTimer = useCallback(
    async (action: "start" | "pause" | "stop") => {
      if (!activeTaskId) return;
      setBusy(action);
      try {
        const fn = action === "start" ? startTimer : action === "pause" ? pauseTimer : stopTimer;
        await fn({ profileId: user.id, taskId: activeTaskId });
        const activeTimer = summary?.activeTimer;
        if (activeTimer) {
          const props = timerLiveActivityProps({
            mode: action === "pause" ? "paused" : "running",
            projectName: activeTimer.projectName,
            taskId: activeTimer.taskId,
            taskTitle: activeTimer.taskTitle,
            workedMs: activeTimer.workedMs,
          });
          if (action === "stop") {
            await endTimerLiveActivity(props);
          } else {
            await startOrUpdateTimerLiveActivity(props);
          }
        }
      } catch (error) {
        Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Intenta de nuevo.");
      } finally {
        setBusy(null);
      }
    },
    [activeTaskId, pauseTimer, startTimer, stopTimer, summary?.activeTimer, user.id],
  );
  const restartLiveActivity = useCallback(async () => {
    const activeTimer = summary?.activeTimer;
    if (!activeTimer) return;
    setBusy("live");
    try {
      await startOrUpdateTimerLiveActivity(
        timerLiveActivityProps({
          mode: activeTimer.mode,
          projectName: activeTimer.projectName,
          taskId: activeTimer.taskId,
          taskTitle: activeTimer.taskTitle,
          workedMs: activeTimer.workedMs,
        }),
        { reset: true },
      );
      Alert.alert("Live Activity", "Se reinició la Live Activity del timer.");
    } catch (error) {
      Alert.alert(
        "No salió el Live Activity",
        error instanceof Error ? error.message : "iOS no devolvió detalle del error.",
      );
    } finally {
      setBusy(null);
    }
  }, [summary?.activeTimer]);

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
            <Text style={styles.bigNumber}>{formatDurationClock(activeWorkedMs)}</Text>
            <View style={styles.inlineActions}>
              {summary.activeTimer.mode === "running" ? (
                <Pressable
                  disabled={busy != null}
                  onPress={() => actOnTimer("pause")}
                  style={styles.smallActionButton}
                >
                  {busy === "pause" ? <ActivityIndicator color="#111" /> : <Ionicons name="pause" size={17} color="#111" />}
                  <Text style={styles.smallActionText}>Pausar</Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={busy != null}
                  onPress={() => actOnTimer("start")}
                  style={styles.smallActionButton}
                >
                  {busy === "start" ? <ActivityIndicator color="#111" /> : <Ionicons name="play" size={17} color="#111" />}
                  <Text style={styles.smallActionText}>Reanudar</Text>
                </Pressable>
              )}
              <Pressable
                disabled={busy != null}
                onPress={() => actOnTimer("stop")}
                style={styles.smallActionButton}
              >
                {busy === "stop" ? <ActivityIndicator color="#111" /> : <Ionicons name="stop" size={17} color="#111" />}
                <Text style={styles.smallActionText}>Detener</Text>
              </Pressable>
              <Pressable
                disabled={busy != null}
                onPress={restartLiveActivity}
                style={styles.smallActionButton}
              >
                {busy === "live" ? <ActivityIndicator color="#111" /> : <Ionicons name="radio-outline" size={17} color="#111" />}
                <Text style={styles.smallActionText}>Live</Text>
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
              <Text style={styles.taskMeta}>{formatDurationClock(timer.workedMs)}</Text>
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
}) {
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

      <View style={styles.field}>
        <Text style={styles.label}>{statusLabel}</Text>
        <View style={styles.statusGrid}>
          {TASK_STATUS_OPTIONS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onStatusChange(item.key)}
              style={[
                styles.statusOption,
                status === item.key && styles.statusOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  status === item.key && styles.statusOptionTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Prioridad</Text>
        <View style={styles.statusGrid}>
          {PRIORITY_OPTIONS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => onPriorityChange(priority === item.key ? null : item.key)}
              style={[
                styles.statusOption,
                priority === item.key && styles.statusOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  priority === item.key && styles.statusOptionTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
        <View style={styles.field}>
          <Text style={styles.label}>Fase</Text>
          <View style={styles.statusGrid}>
            {phases.map((phase) => (
              <Pressable
                key={phase.index}
                onPress={() => onPhaseIndexChange(phase.index)}
                style={[
                  styles.statusOption,
                  phaseIndex === phase.index && styles.statusOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    phaseIndex === phase.index && styles.statusOptionTextActive,
                  ]}
                >
                  {phase.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {members.length > 0 ? (
        <View style={styles.field}>
          <Text style={styles.label}>Encargados</Text>
          <View style={styles.statusGrid}>
            {members.map((member) => {
              const active = ownerIds.includes(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() =>
                    onOwnerIdsChange(
                      active
                        ? ownerIds.filter((id) => id !== member.id)
                        : [...ownerIds, member.id],
                    )
                  }
                  style={[styles.statusOption, active && styles.statusOptionActive]}
                >
                  <Text style={[styles.statusOptionText, active && styles.statusOptionTextActive]}>
                    {member.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
}: {
  user: SessionUser;
  project: Project;
  initialTaskId?: Id<"tareas">;
  onBack: () => void;
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
  const createAvance = useMutation((api as any).mobile.createMobileAvance);
  const [statusTab, setStatusTab] = useState<"todas" | TaskStatus>("todas");
  const [createOpen, setCreateOpen] = useState(false);
  const [avanceOpen, setAvanceOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pendiente");
  const [priority, setPriority] = useState<TaskPriority | null>(null);
  const [tag, setTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [phaseIndex, setPhaseIndex] = useState<number | null>(null);
  const [ownerIds, setOwnerIds] = useState<Id<"profile">[]>([user.id]);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tareas"> | null>(
    initialTaskId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [avanceTitle, setAvanceTitle] = useState("");
  const [avanceDescription, setAvanceDescription] = useState("");
  const [avanceStatus, setAvanceStatus] = useState("En progreso");
  const [avancePhaseIndex, setAvancePhaseIndex] = useState<number | null>(null);
  const [savingAvance, setSavingAvance] = useState(false);

  const tasks = (result?.tasks ?? []) as Task[];
  const members = (result?.members ?? []) as ProjectMember[];
  const phases = (result?.phases ?? []) as ProjectPhase[];
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
      await createTask({
        profileId: user.id,
        projectId: project.id,
        title,
        description: description.trim() || undefined,
        status: newStatus,
        priority: priority ?? undefined,
        tag: tag.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        phaseIndex: phaseIndex ?? undefined,
        ownerIds,
      });
      setTitle("");
      setDescription("");
      setNewStatus("pendiente");
      setPriority(null);
      setTag("");
      setDueDate("");
      setPhaseIndex(null);
      setOwnerIds([user.id]);
      setCreateOpen(false);
    } catch (error) {
      Alert.alert(
        "No se pudo crear la tarea",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }, [createTask, description, dueDate, newStatus, ownerIds, phaseIndex, priority, project.id, tag, title, user.id]);

  const saveAvance = useCallback(async () => {
    if (!avanceTitle.trim()) {
      Alert.alert("Falta nombre", "Ingresa el nombre del avance.");
      return;
    }
    setSavingAvance(true);
    try {
      await createAvance({
        description: avanceDescription.trim(),
        name: avanceTitle.trim(),
        phaseIndex: avancePhaseIndex ?? undefined,
        profileId: user.id,
        projectId: project.id,
        status: avanceStatus.trim() || "En progreso",
      });
      setAvanceTitle("");
      setAvanceDescription("");
      setAvanceStatus("En progreso");
      setAvancePhaseIndex(null);
      setAvanceOpen(false);
    } catch (error) {
      Alert.alert("No se pudo guardar", error instanceof Error ? error.message : "Intenta de nuevo.");
    } finally {
      setSavingAvance(false);
    }
  }, [avanceDescription, avancePhaseIndex, avanceStatus, avanceTitle, createAvance, project.id, user.id]);

  return (
    <SafeAreaView style={styles.dashboard}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.dashboardContent}>
        <View style={styles.detailHeader}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#111" />
          </Pressable>
          <View style={styles.detailTitleBox}>
            <Text numberOfLines={1} style={styles.company}>{project.company}</Text>
            <Text numberOfLines={2} style={styles.detailTitle}>{project.name}</Text>
          </View>
          <Pressable onPress={() => setCreateOpen(true)} style={styles.addButton}>
            <Ionicons name="add" size={25} color="#111" />
          </Pressable>
        </View>

        <View style={styles.projectMini}>
          <Text style={styles.projectMiniLabel}>Etapa actual</Text>
          <Text style={styles.projectMiniValue}>{result?.project.phase ?? project.phase}</Text>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Avance del proyecto</Text>
            <Text style={styles.progressNumber}>{project.percent}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${project.percent}%` }]} />
          </View>
          {projectDetail?.notes ? (
            <Text style={styles.taskDescription}>{projectDetail.notes}</Text>
          ) : null}
        </View>

        {projectDetail ? (
          <>
            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Fases</Text>
                <Text style={styles.taskMeta}>{projectDetail.lifecycle}</Text>
              </View>
              <View style={styles.phaseList}>
                {projectDetail.phases.map((phase) => (
                  <View key={phase.index} style={[styles.phaseRow, phase.active && styles.phaseRowActive]}>
                    <View style={[styles.taskStatusDot, { backgroundColor: phase.completed ? "#067647" : phase.active ? "#111" : "#98a2b3" }]} />
                    <View style={styles.projectTitleBox}>
                      <Text numberOfLines={1} style={styles.taskTitle}>{phase.name}</Text>
                      <Text style={styles.taskMeta}>{phase.dueDate || "Sin fecha"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.sectionTitle}>Equipo</Text>
              <View style={styles.statusGrid}>
                {projectDetail.members.map((member) => (
                  <View key={member.id} style={styles.statusOption}>
                    <Text style={styles.statusOptionText}>{member.name}</Text>
                    <Text numberOfLines={1} style={styles.attachmentMeta}>{member.role}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tickets recientes</Text>
                <Text style={styles.taskMeta}>{projectDetail.tickets.length}</Text>
              </View>
              {projectDetail.tickets.length === 0 ? (
                <Text style={styles.stateText}>Sin tickets para este proyecto.</Text>
              ) : (
                projectDetail.tickets.map((ticket) => (
                  <View key={ticket.id} style={styles.attachmentRow}>
                    <Ionicons name="ticket-outline" size={18} color="#667085" />
                    <Text numberOfLines={1} style={styles.attachmentName}>{ticket.title}</Text>
                    <Text style={styles.taskMeta}>{ticketStatusLabel(ticket.status)}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.detailCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Avances</Text>
                <Pressable onPress={() => setAvanceOpen(true)} style={styles.inlineIconButton}>
                  <Ionicons name="add" size={17} color="#111" />
                </Pressable>
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
          </>
        ) : null}

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
            <Text style={styles.stateText}>Crea una nueva tarea con el botón superior.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} onPress={() => setSelectedTaskId(task.id)} task={task} />
            ))}
          </View>
        )}
      </ScrollView>

      <TaskDetailModal
        members={members}
        onClose={() => setSelectedTaskId(null)}
        phases={phases}
        taskId={selectedTaskId}
        user={user}
      />

      <Modal animationType="slide" onRequestClose={() => setAvanceOpen(false)} visible={avanceOpen}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setAvanceOpen(false)} style={styles.backButton}>
              <Ionicons name="close" size={24} color="#111" />
            </Pressable>
            <Text style={styles.modalTitle}>Nuevo avance</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Nombre</Text>
              <View style={styles.inputShell}>
                <Ionicons name="flag-outline" size={19} color="#7a8088" />
                <TextInput
                  onChangeText={setAvanceTitle}
                  placeholder="Qué se avanzó"
                  placeholderTextColor="#9aa0a8"
                  style={styles.input}
                  value={avanceTitle}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                multiline
                onChangeText={setAvanceDescription}
                placeholder="Detalle del avance"
                placeholderTextColor="#9aa0a8"
                style={styles.textarea}
                value={avanceDescription}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Estado</Text>
              <View style={styles.statusGrid}>
                {["En progreso", "Completado", "Bloqueado"].map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setAvanceStatus(item)}
                    style={[styles.statusOption, avanceStatus === item && styles.statusOptionActive]}
                  >
                    <Text style={[styles.statusOptionText, avanceStatus === item && styles.statusOptionTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {phases.length > 0 ? (
              <View style={styles.field}>
                <Text style={styles.label}>Fase</Text>
                <View style={styles.statusGrid}>
                  {phases.map((phase) => (
                    <Pressable
                      key={phase.index}
                      onPress={() => setAvancePhaseIndex(phase.index)}
                      style={[styles.statusOption, avancePhaseIndex === phase.index && styles.statusOptionActive]}
                    >
                      <Text style={[styles.statusOptionText, avancePhaseIndex === phase.index && styles.statusOptionTextActive]}>
                        {phase.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <Pressable disabled={savingAvance} onPress={saveAvance} style={[styles.primaryButton, savingAvance && styles.pressed]}>
              {savingAvance ? <ActivityIndicator color="#111" /> : <Text style={styles.primaryText}>Guardar avance</Text>}
            </Pressable>
          </ScrollView>
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
              description={description}
              dueDate={dueDate}
              members={members}
              onDescriptionChange={setDescription}
              onDueDateChange={setDueDate}
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
  const generateCommentUploadUrl = useMutation(api.comentarioTareas.generateUploadUrl);
  const generateTaskUploadUrl = useMutation(api.tareas.generateUploadUrl);
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
          ? await uploadPickedAttachments(commentAttachments, () => generateCommentUploadUrl({}))
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
  }, [addComment, comment, commentAttachments, generateCommentUploadUrl, taskId, user.id]);

  const addAttachmentsToTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const attachments = await pickAttachments();
      if (attachments.length === 0) return;

      setUploadingTaskAttachments(true);
      const uploaded = await uploadPickedAttachments(attachments, () => generateTaskUploadUrl({}));
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
  }, [addTaskAttachments, generateTaskUploadUrl, taskId]);

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
    taskId && String(workSummary?.activeTimer?.taskId ?? "") === String(taskId),
  );
  const timerMode = activeForThisTask ? workSummary?.activeTimer?.mode : null;
  const canStartOrResumeTimer = !activeForThisTask || timerMode !== "running";
  const detailWorkedMs = useLiveWorkedMs(activeForThisTask ? workSummary?.activeTimer : null);
  const runTimerAction = useCallback(
    async (action: "start" | "pause" | "stop") => {
      if (!taskId) return;
      setTimerAction(action);
      try {
        const fn = action === "start" ? startTimer : action === "pause" ? pauseTimer : stopTimer;
        await fn({ profileId: user.id, taskId });
        if (detail) {
          const props = timerLiveActivityProps({
            mode: action === "pause" ? "paused" : "running",
            projectName: detail.project.name,
            taskId,
            taskTitle: detail.title,
            workedMs: workSummary?.activeTimer?.taskId === taskId
              ? workSummary.activeTimer.workedMs
              : 0,
          });
          if (action === "stop") {
            await endTimerLiveActivity(props);
          } else {
            await startOrUpdateTimerLiveActivity(props, { reset: action === "start" });
          }
        }
      } catch (error) {
        Alert.alert("No se pudo actualizar el timer", error instanceof Error ? error.message : "Intenta de nuevo.");
      } finally {
        setTimerAction(null);
      }
    },
    [detail, pauseTimer, startTimer, stopTimer, taskId, user.id, workSummary?.activeTimer],
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
                      ? `${timerMode === "running" ? "Corriendo" : "Pausado"} · ${formatDurationClock(detailWorkedMs)}`
                      : "Sin timer activo en esta tarea"}
                  </Text>
                </View>
                <View style={styles.inlineActions}>
                  {canStartOrResumeTimer ? (
                    <Pressable
                      disabled={timerAction != null}
                      onPress={() => runTimerAction("start")}
                      style={styles.smallActionButton}
                    >
                      {timerAction === "start" ? <ActivityIndicator color="#111" /> : <Ionicons name="play" size={17} color="#111" />}
                      <Text style={styles.smallActionText}>{activeForThisTask ? "Reanudar" : "Iniciar"}</Text>
                    </Pressable>
                  ) : null}
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
    borderRadius: 14,
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
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
  },
  pressed: { opacity: 0.7 },
  primaryText: { color: "#111", fontSize: 16, fontWeight: "900" },
  dashboard: { backgroundColor: "#f6f5ef", flex: 1 },
  dashboardContent: { padding: 18, paddingBottom: 32 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  headerActions: { flexDirection: "row", gap: 8 },
  hello: { color: "#111", fontSize: 26, fontWeight: "900" },
  subhead: { color: "#65605a", fontSize: 15, marginTop: 3 },
  logout: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 14,
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
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  summary: { backgroundColor: "#111", borderRadius: 20, flexDirection: "row", marginBottom: 18, padding: 14 },
  summaryItem: { flex: 1, gap: 4 },
  summaryValue: { color: "#f6de39", fontSize: 22, fontWeight: "900", textAlign: "center" },
  summaryLabel: { color: "#ebe7d9", fontSize: 11, fontWeight: "700", textAlign: "center" },
  segmented: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    padding: 5,
  },
  segmentButton: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
  },
  segmentButtonActive: { backgroundColor: "#111" },
  segmentText: { color: "#475467", fontSize: 13, fontWeight: "900" },
  segmentTextActive: { color: "#fff" },
  segmentCount: { color: "#667085", fontSize: 12, fontWeight: "900" },
  searchShell: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 15,
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
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  tabButtonActive: { backgroundColor: "#111", borderColor: "#111" },
  tabText: { color: "#475467", fontSize: 13, fontWeight: "800" },
  tabTextActive: { color: "#fff" },
  tabCount: { color: "#667085", fontSize: 12, fontWeight: "900" },
  stateCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 20, gap: 10, padding: 28 },
  emptyTitle: { color: "#111", fontSize: 18, fontWeight: "900" },
  stateText: { color: "#667085", fontSize: 14, lineHeight: 20, textAlign: "center" },
  panelStack: { gap: 14 },
  list: { gap: 14 },
  projectCard: { backgroundColor: "#fff", borderColor: "#ece7da", borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 },
  cardPressed: { opacity: 0.72 },
  projectHead: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  projectIcon: { alignItems: "center", backgroundColor: "#f6de39", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  projectIconText: { color: "#111", fontSize: 20, fontWeight: "900" },
  projectTitleBox: { flex: 1, minWidth: 0 },
  company: { color: "#7b7264", fontSize: 12, fontWeight: "800", marginBottom: 3 },
  projectName: { color: "#111", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  favoriteBadge: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "900" },
  phaseChip: {
    backgroundColor: "#f6de39",
    borderRadius: 999,
    maxWidth: 126,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  phaseChipText: { color: "#111", fontSize: 12, fontWeight: "900" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  metaText: { color: "#475467", flex: 1, fontSize: 14, fontWeight: "700" },
  progressTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { color: "#667085", fontSize: 13, fontWeight: "800" },
  progressNumber: { color: "#111", fontSize: 14, fontWeight: "900" },
  track: { backgroundColor: "#eee9dc", borderRadius: 999, height: 9, overflow: "hidden" },
  fill: { backgroundColor: "#f6de39", borderRadius: 999, height: 9 },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { backgroundColor: "#f8f7f2", borderRadius: 12, flex: 1, gap: 4, minHeight: 78, padding: 10 },
  metricLabel: { color: "#667085", fontSize: 11, fontWeight: "800" },
  metricValue: { color: "#111", fontSize: 13, fontWeight: "900" },
  linkButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#f6de39", borderRadius: 12, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  linkButtonText: { color: "#111", fontSize: 13, fontWeight: "900" },
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
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  detailTitleBox: { flex: 1, minWidth: 0 },
  detailTitle: { color: "#111", fontSize: 22, fontWeight: "900", lineHeight: 27 },
  projectMini: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
    padding: 16,
  },
  projectMiniLabel: { color: "#667085", fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  projectMiniValue: { color: "#111", fontSize: 17, fontWeight: "900" },
  phaseList: { gap: 8 },
  phaseRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  phaseRowActive: { backgroundColor: "#fff7c2", borderColor: "#f6de39", borderWidth: 1 },
  taskRow: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  taskRowTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  taskStatusDot: { borderRadius: 999, height: 10, marginTop: 7, width: 10 },
  taskTitleBox: { flex: 1, minWidth: 0 },
  taskTitle: { color: "#111", fontSize: 16, fontWeight: "900", lineHeight: 20 },
  taskDescription: { color: "#4f5865", fontSize: 13, lineHeight: 19 },
  taskFooter: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  taskMeta: { color: "#667085", flexShrink: 1, fontSize: 12, fontWeight: "700" },
  detailCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  detailTaskTitle: { color: "#111", fontSize: 22, fontWeight: "900", lineHeight: 27 },
  ticketCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  timerBox: {
    backgroundColor: "#f8f7f2",
    borderRadius: 14,
    gap: 12,
    padding: 12,
  },
  inlineActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bigNumber: { color: "#111", fontSize: 30, fontWeight: "900" },
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
    borderRadius: 12,
    gap: 4,
    minHeight: 68,
    padding: 10,
    width: "48%",
  },
  sectionTitle: { color: "#111", fontSize: 16, fontWeight: "900", marginTop: 4 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  smallActionButton: {
    alignItems: "center",
    backgroundColor: "#f6de39",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
  },
  smallActionText: { color: "#111", fontSize: 12, fontWeight: "900" },
  attachmentRow: {
    alignItems: "center",
    backgroundColor: "#f8f7f2",
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  attachmentName: { color: "#111", flex: 1, fontSize: 13, fontWeight: "800" },
  attachmentMeta: { color: "#667085", fontSize: 11, fontWeight: "700" },
  inlineIconButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  commentBubble: {
    backgroundColor: "#f8f7f2",
    borderRadius: 14,
    gap: 5,
    padding: 12,
  },
  commentAuthor: { color: "#667085", fontSize: 12, fontWeight: "800" },
  commentText: { color: "#111", fontSize: 14, lineHeight: 20 },
  commentAttachmentList: { gap: 6, marginTop: 4 },
  commentAttachment: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 9,
  },
  commentAttachmentText: { color: "#475467", flex: 1, fontSize: 12, fontWeight: "800" },
  selectedAttachments: { gap: 8, marginTop: 4 },
  selectedAttachment: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 12,
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
    borderRadius: 14,
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
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  notificationCard: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  notificationUnread: { borderColor: "#f6de39", borderWidth: 2 },
  notificationTop: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  notificationTitle: { color: "#111", flex: 1, fontSize: 16, fontWeight: "900", lineHeight: 20 },
  unreadDot: { backgroundColor: "#f04438", borderRadius: 999, height: 9, marginTop: 5, width: 9 },
  notificationLink: { color: "#111", fontSize: 13, fontWeight: "900", marginTop: 2 },
  modalRoot: { backgroundColor: "#f6f5ef", flex: 1 },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalTitle: { color: "#111", flex: 1, fontSize: 20, fontWeight: "900", textAlign: "center" },
  headerSpacer: { height: 44, width: 44 },
  modalContent: { gap: 18, padding: 18, paddingBottom: 34 },
  textarea: {
    backgroundColor: "#fff",
    borderColor: "#e6e2d6",
    borderRadius: 14,
    borderWidth: 1,
    color: "#111",
    fontSize: 15,
    minHeight: 120,
    padding: 14,
    textAlignVertical: "top",
  },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  statusOption: {
    backgroundColor: "#fff",
    borderColor: "#ece7da",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statusOptionActive: { backgroundColor: "#111", borderColor: "#111" },
  statusOptionText: { color: "#475467", fontSize: 13, fontWeight: "800" },
  statusOptionTextActive: { color: "#fff" },
});
