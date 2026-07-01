import { Platform } from "react-native";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import { HStack, Spacer, Text, VStack, ZStack } from "@expo/ui/swift-ui";
import {
  background,
  bold,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
} from "@expo/ui/swift-ui/modifiers";

export type TimerLiveActivityProps = {
  taskId: string;
  taskTitle: string;
  projectName: string;
  startedAt: number;
  accumulatedMs: number;
  mode: "running" | "paused";
  updatedAt: number;
};

type TimerLiveActivityHandle = LiveActivity<TimerLiveActivityProps>;

let currentActivity: TimerLiveActivityHandle | null = null;
let currentTaskId: string | null = null;
let activityFactory: LiveActivityFactory<TimerLiveActivityProps> | null = null;

function TimerLiveActivityLayout(props: TimerLiveActivityProps) {
  "widget";

  const title = props.taskTitle || "Timer Authcode";
  const project = props.projectName || "Proyecto";
  const elapsedMs =
    props.accumulatedMs +
    (props.mode === "running" ? Math.max(0, Date.now() - props.updatedAt) : 0);
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const elapsedLabel = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const interval =
    props.mode === "running"
      ? {
          lower: new Date(props.updatedAt - props.accumulatedMs),
          upper: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }
      : undefined;
  const timerText = (size: number) =>
    interval ? (
      <Text
        countsDown={false}
        modifiers={[font({ design: "monospaced", size, weight: "bold" }), monospacedDigit()]}
        timerInterval={interval}
      />
    ) : (
      <Text modifiers={[font({ design: "monospaced", size, weight: "bold" }), monospacedDigit()]}>
        {elapsedLabel}
      </Text>
    );
  const pill = () => (
    <HStack
      alignment="center"
      modifiers={[
        background(props.mode === "running" ? "#DCFCE7" : "#FEF0C7"),
        clipShape("capsule"),
        padding({ horizontal: 8, vertical: 5 }),
      ]}
      spacing={5}
    >
      <Text
        modifiers={[
          font({ size: 12, weight: "bold" }),
          foregroundStyle(props.mode === "running" ? "#067647" : "#B54708"),
        ]}
      >
        {props.mode === "running" ? "LIVE" : "PAUSA"}
      </Text>
    </HStack>
  );

  const banner = (
    <HStack
      alignment="center"
      modifiers={[background("#111111"), padding({ horizontal: 16, vertical: 14 })]}
      spacing={12}
    >
      <ZStack
        modifiers={[
          background("#F6DE39"),
          clipShape("roundedRectangle", 12),
          frame({ height: 44, width: 44 }),
        ]}
      >
        <Text modifiers={[font({ size: 18, weight: "black" }), foregroundStyle("#111111")]}>A</Text>
      </ZStack>
      <VStack alignment="leading" modifiers={[frame({ maxWidth: 220 })]} spacing={3}>
        <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle("#C9CED6"), lineLimit(1)]}>
          {project}
        </Text>
        <Text modifiers={[bold(), font({ size: 16, weight: "bold" }), foregroundStyle("#FFFFFF"), lineLimit(1)]}>
          {title}
        </Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={4}>
        {pill()}
        {timerText(22)}
      </VStack>
    </HStack>
  );

  return {
    banner,
    compactLeading: (
      <Text modifiers={[font({ size: 13, weight: "bold" }), foregroundStyle("#F6DE39")]}>
        {props.mode === "running" ? ">" : "II"}
      </Text>
    ),
    compactTrailing: timerText(13),
    minimal: (
      <Text modifiers={[font({ size: 12, weight: "bold" }), foregroundStyle("#F6DE39")]}>A</Text>
    ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11, weight: "semibold" }), foregroundStyle("#C9CED6"), lineLimit(1)]}>
          {project}
        </Text>
        <Text modifiers={[font({ size: 14, weight: "bold" }), foregroundStyle("#FFFFFF"), lineLimit(1)]}>
          {title}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2}>
        {pill()}
        {timerText(18)}
      </VStack>
    ),
    expandedBottom: banner,
  };
}

async function getTimerLiveActivityFactory() {
  if (activityFactory) return activityFactory;
  const widgets = await import("expo-widgets");
  activityFactory = widgets.createLiveActivity<TimerLiveActivityProps>(
    "AuthcodeTimer",
    TimerLiveActivityLayout as any,
  );
  return activityFactory;
}

async function closeKnownLiveActivities(factory: LiveActivityFactory<TimerLiveActivityProps>, props?: TimerLiveActivityProps) {
  const instances = factory.getInstances();
  await Promise.all(instances.map((instance) => instance.end("immediate", props).catch(() => {})));
}

export async function startOrUpdateTimerLiveActivity(
  props: TimerLiveActivityProps,
  options?: { reset?: boolean },
) {
  if (Platform.OS !== "ios") return false;

  const factory = await getTimerLiveActivityFactory();

  if (options?.reset) {
    await closeKnownLiveActivities(factory, props);
    currentActivity = null;
    currentTaskId = null;
  }

  if (currentActivity && currentTaskId === props.taskId) {
    await currentActivity.update(props);
    return true;
  }

  if (currentActivity) {
    await currentActivity.end("immediate", props).catch(() => {});
    currentActivity = null;
    currentTaskId = null;
  }

  currentActivity = factory.start(props, "authcode://timer");
  currentTaskId = props.taskId;
  await currentActivity.update(props);
  return true;
}

export async function endTimerLiveActivity(props?: TimerLiveActivityProps) {
  if (Platform.OS !== "ios" || !currentActivity) return;

  try {
    await currentActivity.end("immediate", props);
  } catch (error) {
    console.warn("[live-activity] No se pudo cerrar el timer", error);
  } finally {
    currentActivity = null;
    currentTaskId = null;
  }
}
