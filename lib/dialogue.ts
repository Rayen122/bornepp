import { Alert, Platform } from 'react-native';

// Alert.alert n'affiche rien sur react-native-web : on bascule sur les dialogues du navigateur.

export function confirmer(
  titre: string,
  message: string,
  { confirmer: libelle = 'Confirmer', annuler = 'Annuler', destructif = false } = {}
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${titre}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(titre, message, [
      { text: annuler, style: 'cancel', onPress: () => resolve(false) },
      { text: libelle, style: destructif ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function informer(titre: string, message: string): void {
  if (Platform.OS === 'web') {
    window.alert(`${titre}\n\n${message}`);
    return;
  }
  Alert.alert(titre, message);
}
