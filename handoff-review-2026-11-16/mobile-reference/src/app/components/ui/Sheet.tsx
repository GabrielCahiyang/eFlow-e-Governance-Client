import { brandColors, withOpacity } from "./theme";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Pressable, ScrollView, View } from "./Primitives";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import X from "lucide-react-native/icons/x";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  motionDuration,
  motionEase,
  useMotionPreferences,
} from "../../shared/motion";
import { colors } from "./theme";
import { Text } from "./Typography";
import { useAppearance, useTheme, themedStyle } from "./Appearance";
import { ErrorState } from "./Screen";
import { OperationStatus } from "./OperationStatus";

const SheetHostContext = createContext(false);

/**
 * Keeps a single native <Modal> mounted across multi-step sheet transitions
 * so UIKit / Android never drops an incoming sheet while tearing down the old one.
 */
export function SheetModalHost({
  open,
  onClose,
  busy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const alreadyHosted = useContext(SheetHostContext);
  const { reduced } = useMotionPreferences();
  const [present, setPresent] = useState(open);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const duration = reduced ? 0 : motionDuration.productiveLong;
    const timer = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(timer);
  }, [open, reduced]);

  if (alreadyHosted) return <>{children}</>;

  return (
    <Modal
      visible={present}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SheetHostContext.Provider value={true}>
        {children}
      </SheetHostContext.Provider>
    </Modal>
  );
}

export function Sheet({
  title,
  open,
  onClose,
  children,
  footer,
  busy,
  actionError,
  description,
  presentation = "dialog",
  maxWidth = 900,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  actionError?: unknown;
  description?: string;
  presentation?: "dialog" | "inspector";
  maxWidth?: number;
}) {
  const hosted = useContext(SheetHostContext);
  const { isDark } = useAppearance();
  const palette = useTheme();
  const inset = useSafeAreaInsets(),
    { width, height } = useWindowDimensions(),
    { reduced } = useMotionPreferences();
  const [present, setPresent] = useState(open);
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (!hosted || !open) return;
    AccessibilityInfo.announceForAccessibility(title);
  }, [hosted, open, title]);
  useEffect(() => {
    if (!open || !actionError) return;
    const frame = requestAnimationFrame(() =>
      body.current?.scrollTo({ y: 0, animated: !reduced }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open, actionError, reduced]);
  const progress = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(progress);
    if (open) setPresent(true);
    const curve = open ? motionEase.enter : motionEase.exit;
    progress.value = withTiming(
      open ? 1 : 0,
      {
        duration: reduced ? 0 : motionDuration.productiveLong,
        easing: Easing.bezier(curve[0], curve[1], curve[2], curve[3]),
      },
      (finished) => {
        if (finished && !open) runOnJS(setPresent)(false);
      },
    );
    return () => cancelAnimation(progress);
  }, [open, reduced]);
  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: presentation === "inspector" ? 1 : progress.value,
    transform:
      presentation === "inspector"
        ? [{ translateX: (1 - progress.value) * Math.min(width, 900) }]
        : [
            { scale: 0.96 + 0.04 * progress.value },
            { translateY: (1 - progress.value) * 6 },
          ],
  }));
  const close = () => {
    if (!busy) onClose();
  };
  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        s.container,
        {
          paddingTop: Math.max(inset.top, 16),
          paddingBottom: Math.max(inset.bottom, 16),
        },
        presentation === "inspector" && {
          alignItems: "flex-end",
          padding: 0,
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          s.shade,
          hosted ? { opacity: 1 } : backdrop,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          disabled={busy}
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityState={{ busy: !!busy }}
        style={[
          themedStyle(s.panel, isDark),
          {
            width: Math.min(width - 32, maxWidth),
            maxHeight: height - inset.top - inset.bottom - 32,
          },
          presentation === "inspector" && {
            width: Math.min(width, maxWidth),
            borderRadius: 0,
            height: "100%",
            maxHeight: "100%",
          },
          panel,
        ]}
      >
        <View style={s.header}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            {!!description && (
              <Text style={s.description}>{description}</Text>
            )}
            <OperationStatus />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
            accessibilityState={{ disabled: !!busy }}
            disabled={busy}
            onPress={close}
            style={s.close}
          >
            <X color={palette.text} size={22} />
          </Pressable>
        </View>
        <ScrollView
          ref={body}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          {!!actionError && <ErrorState context="action" error={actionError} />}
          <SheetHostContext.Provider value={false}>
            {children}
          </SheetHostContext.Provider>
        </ScrollView>
        {!!footer && (
          <View style={s.footer}>
            <SheetHostContext.Provider value={false}>
              {footer}
            </SheetHostContext.Provider>
          </View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );

  if (hosted) return present ? content : null;

  return (
    <Modal
      visible={present}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
      onShow={() => AccessibilityInfo.announceForAccessibility(title)}
    >
      {content}
    </Modal>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  shade: { backgroundColor: withOpacity(brandColors.navy, 0.45) },
  panel: {
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  header: {
    padding: 24,
    flexDirection: "row",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "flex-start",
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  description: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  close: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 24, gap: 16 },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
});
