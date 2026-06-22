import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ConvexProvider, useMutation, useQuery } from "convex/react";
import { ConvexReactClient } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
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

const SESSION_KEY = "authcode.mobile.session";
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("Falta EXPO_PUBLIC_CONVEX_URL en .env");
}

const convex = new ConvexReactClient(convexUrl);

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
};

type ProjectTab = "todos" | string;

type TaskStatus =
  | "idea"
  | "pendiente"
  | "prioridad"
  | "proceso"
  | "qa"
  | "produccion"
  | "completada";

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

type TaskDetail = {
  id: Id<"tareas">;
  title: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  priority: "alta" | "media" | "baja" | null;
  tag: string | null;
  dueDate: string;
  phaseName: string;
  project: {
    id: Id<"proyectos">;
    name: string;
    company: string;
  };
  owners: Array<{ id: Id<"profile">; name: string; email: string }>;
  attachments: Array<{ name: string }>;
  comments: Array<{
    id: Id<"comentariosTareas">;
    content: string;
    authorName: string;
    createdLabel: string;
    attachmentNames: string[];
  }>;
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

const PRIORITY_OPTIONS: Array<{ key: "alta" | "media" | "baja"; label: string }> = [
  { key: "alta", label: "Alta" },
  { key: "media", label: "Media" },
  { key: "baja", label: "Baja" },
];

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

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => Promise<void> }) {
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
      const result = await convex.query(api.users.verifyCredentials, {
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
  }, [email, onLogin, password]);

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
  const notificationsResult = useQuery(api.mobile.getNotifications, {
    profileId: user.id,
    limit: 40,
  });
  const markNotificationRead = useMutation(api.mobile.markNotificationRead);
  const projects = (result?.projects ?? []) as Project[];
  const loading = result === undefined;
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ProjectTab>("todos");
  const [selectedProject, setSelectedProject] = useState<{
    project: Project;
    taskId?: Id<"tareas">;
  } | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const projectTabs = useMemo(() => {
    const phases = [...new Set(projects.map((project) => project.phase))];
    return [
      { key: "todos" as ProjectTab, label: "Todos", count: projects.length },
      ...phases.map((phase) => ({
        key: phase,
        label: phase,
        count: projects.filter((project) => project.phase === phase).length,
      })),
    ];
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      const byTab = tab === "todos" || project.phase === tab;
      const bySearch =
        term.length === 0 ||
        project.name.toLowerCase().includes(term) ||
        project.company.toLowerCase().includes(term) ||
        project.phase.toLowerCase().includes(term);
      return byTab && bySearch;
    });
  }, [projects, search, tab]);

  const stats = useMemo(
    () => ({
      total: projects.length,
      risk: projects.filter((p) => p.band === "risk").length,
      critical: projects.filter((p) => p.band === "critical").length,
      done: projects.filter((p) => p.percent >= 100).length,
    }),
    [projects],
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
        ) : projects.length === 0 ? (
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
      </ScrollView>

      <NotificationsModal
        notifications={(notificationsResult?.notifications ?? []) as NotificationItem[]}
        onClose={() => setNotificationsOpen(false)}
        onOpenLinked={async (notification) => {
          await markNotificationRead({
            profileId: user.id,
            notificationId: notification.id,
          }).catch(() => {});
          const project = projects.find((item) => item.id === notification.projectId);
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
  const createTask = useMutation(api.mobile.createProjectTask);
  const [statusTab, setStatusTab] = useState<"todas" | TaskStatus>("todas");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("pendiente");
  const [priority, setPriority] = useState<"alta" | "media" | "baja" | null>(null);
  const [tag, setTag] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [phaseIndex, setPhaseIndex] = useState<number | null>(null);
  const [ownerIds, setOwnerIds] = useState<Id<"profile">[]>([user.id]);
  const [selectedTaskId, setSelectedTaskId] = useState<Id<"tareas"> | null>(
    initialTaskId ?? null,
  );
  const [saving, setSaving] = useState(false);

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
        onClose={() => setSelectedTaskId(null)}
        taskId={selectedTaskId}
        user={user}
      />

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
            <View style={styles.field}>
              <Text style={styles.label}>Título</Text>
              <View style={styles.inputShell}>
                <Ionicons name="create-outline" size={19} color="#7a8088" />
                <TextInput
                  onChangeText={setTitle}
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
                onChangeText={setDescription}
                placeholder="Detalle breve de lo que se debe hacer"
                placeholderTextColor="#9aa0a8"
                style={styles.textarea}
                value={description}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Estado inicial</Text>
              <View style={styles.statusGrid}>
                {TASK_STATUS_OPTIONS.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setNewStatus(item.key)}
                    style={[
                      styles.statusOption,
                      newStatus === item.key && styles.statusOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        newStatus === item.key && styles.statusOptionTextActive,
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
                    onPress={() => setPriority(priority === item.key ? null : item.key)}
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
                  onChangeText={setTag}
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
                  onChangeText={setDueDate}
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
                      onPress={() => setPhaseIndex(phase.index)}
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
                          setOwnerIds((current) =>
                            current.includes(member.id)
                              ? current.filter((id) => id !== member.id)
                              : [...current, member.id],
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
  onClose,
}: {
  user: SessionUser;
  taskId: Id<"tareas"> | null;
  onClose: () => void;
}) {
  const detail = useQuery(
    api.mobile.getTaskDetail,
    taskId ? { profileId: user.id, taskId } : "skip",
  ) as TaskDetail | null | undefined;
  const addComment = useMutation(api.mobile.createTaskComment);
  const updateTask = useMutation(api.mobile.updateProjectTask);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<TaskStatus | null>(null);

  const send = useCallback(async () => {
    if (!taskId || !comment.trim()) return;
    setSending(true);
    try {
      await addComment({
        profileId: user.id,
        taskId,
        content: comment,
      });
      setComment("");
    } catch (error) {
      Alert.alert(
        "No se pudo comentar",
        error instanceof Error ? error.message : "Intenta de nuevo.",
      );
    } finally {
      setSending(false);
    }
  }, [addComment, comment, taskId, user.id]);

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

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={taskId != null}>
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.backButton}>
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
          <Text style={styles.modalTitle}>Detalle de tarea</Text>
          <View style={styles.headerSpacer} />
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
              {detail.attachments.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Adjuntos</Text>
                  {detail.attachments.map((attachment, index) => (
                    <Text key={`${attachment.name}-${index}`} style={styles.stateText}>
                      {attachment.name}
                    </Text>
                  ))}
                </>
              ) : null}
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
                  </View>
                ))
              )}

              <View style={styles.commentComposer}>
                <TextInput
                  multiline
                  onChangeText={setComment}
                  placeholder="Escribe un comentario"
                  placeholderTextColor="#9aa0a8"
                  style={styles.commentInput}
                  value={comment}
                />
                <Pressable
                  disabled={sending || !comment.trim()}
                  onPress={send}
                  style={[styles.sendButton, (sending || !comment.trim()) && styles.pressed]}
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

function Root() {
  const { user, loading, login, logout } = useSession();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#f6de39" />
      </View>
    );
  }

  return user ? <Dashboard onLogout={logout} user={user} /> : <LoginScreen onLogin={login} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ConvexProvider client={convex}>
        <Root />
      </ConvexProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { alignItems: "center", backgroundColor: "#111", flex: 1, justifyContent: "center" },
  loginRoot: { flex: 1 },
  loginContent: { flex: 1, justifyContent: "flex-end", padding: 18 },
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
  list: { gap: 14 },
  projectCard: { backgroundColor: "#fff", borderColor: "#ece7da", borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 },
  cardPressed: { opacity: 0.72 },
  projectHead: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  projectIcon: { alignItems: "center", backgroundColor: "#f6de39", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  projectIconText: { color: "#111", fontSize: 20, fontWeight: "900" },
  projectTitleBox: { flex: 1, minWidth: 0 },
  company: { color: "#7b7264", fontSize: 12, fontWeight: "800", marginBottom: 3 },
  projectName: { color: "#111", fontSize: 18, fontWeight: "900", lineHeight: 22 },
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
  commentBubble: {
    backgroundColor: "#f8f7f2",
    borderRadius: 14,
    gap: 5,
    padding: 12,
  },
  commentAuthor: { color: "#667085", fontSize: 12, fontWeight: "800" },
  commentText: { color: "#111", fontSize: 14, lineHeight: 20 },
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
