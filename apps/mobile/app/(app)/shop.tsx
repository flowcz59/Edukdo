import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

export default function ShopScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Boutique — à implémenter</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
