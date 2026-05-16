import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { makeStyles, Colors, Spacing, BorderRadius } from '../../constants/theme';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

export default function LoginScreen() {
  const styles = useStyles();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = 'L\'adresse email est requise.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Adresse email invalide.';
    }
    if (!password) {
      next.password = 'Le mot de passe est requis.';
    } else if (password.length < 6) {
      next.password = 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const { user, accessToken, refreshToken } = await authService.login(
        email.trim().toLowerCase(),
        password,
      );
      await login(accessToken, refreshToken, user);
      // AuthGuard in root layout handles redirect to (app)/home
    } catch (err: any) {
      const message =
        err?.response?.data?.message ?? 'Identifiants incorrects. Veuillez réessayer.';
      Alert.alert('Connexion impossible', message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / En-tête */}
        <View style={styles.header}>
          <Text style={styles.logo}>EDUKDO</Text>
          <Text style={styles.tagline}>Tes notes, tes récompenses.</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="ton@email.fr"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.darkBg} />
            ) : (
              <Text style={styles.buttonText}>Se connecter</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Lien inscription */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas encore de compte ?{' '}</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Créer un compte</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = () =>
  makeStyles(({ Colors, Spacing, BorderRadius }) => ({
    flex: {
      flex: 1,
      backgroundColor: Colors.darkBg,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xxl,
    },
    header: {
      alignItems: 'center',
      marginBottom: Spacing.xxl,
    },
    logo: {
      fontSize: 36,
      fontWeight: '800',
      color: Colors.gold,
      letterSpacing: 3,
    },
    tagline: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: Spacing.sm,
    },
    form: {
      gap: Spacing.md,
    },
    field: {
      gap: Spacing.xs,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: Colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: Colors.cardBg,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      color: Colors.textPrimary,
    },
    inputError: {
      borderColor: Colors.error,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error,
    },
    button: {
      backgroundColor: Colors.gold,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: Colors.darkBg,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    footerText: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '600',
      color: Colors.gold,
    },
  }));
