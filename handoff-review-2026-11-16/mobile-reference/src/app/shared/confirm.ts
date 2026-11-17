import { Alert } from "react-native";
let confirming = false;
export function confirmAction(
  title: string,
  message: string,
  action = "Continue",
  destructive = false,
): Promise<boolean> {
  if (confirming) return Promise.resolve(false);
  confirming = true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      confirming = false;
      resolve(accepted);
    };
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => finish(false) },
        {
          text: action,
          style: destructive ? "destructive" : "default",
          onPress: () => finish(true),
        },
      ],
      { cancelable: true, onDismiss: () => finish(false) },
    );
  });
}
