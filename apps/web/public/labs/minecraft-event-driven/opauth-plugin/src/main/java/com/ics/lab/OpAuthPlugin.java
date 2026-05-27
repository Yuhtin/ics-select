package com.ics.lab;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OpAuthPlugin — cada OP tem sua própria senha.
 *
 * Modelo de ameaça:
 *   Cenário: bot/aluno descobriu o PIN (6769) e conectou no servidor.
 *   Sem o OpAuth, basta ele estar em ops.json pra ter poder total.
 *   Com o OpAuth, ops.json não é a fonte da verdade — quem manda é o
 *   arquivo opauth-config.yml + senha individual.
 *
 * Fluxo:
 *   1. No PlayerJoinEvent (MONITOR · roda DEPOIS da PinPlugin):
 *      - Se player.isOp() = true, p.setOp(false) imediatamente.
 *      - Se ele está em opauth-config.yml, marca needs_auth.
 *   2. /opauth &lt;senha&gt; — se hash bate, p.setOp(true) e marca authenticated.
 *   3. /opauth-set &lt;nova&gt; — só funciona se authenticated (ou se primeira vez registrado sem senha).
 *   4. Console only: /opauth-register &lt;player&gt; &lt;senha&gt;, /opauth-list, /opauth-remove &lt;player&gt;.
 *   5. No quit: p.setOp(false), clear authenticated.
 *
 * Hashing: SHA-256(password || uuid). UUID serve de salt determinístico —
 *   se a config vazar, atacante não consegue rainbow-table cross-player.
 *
 * Resultado: ops.json fica sempre "offline = ninguém é op", o que é
 *   defensável mesmo se o arquivo vazar. A real lista vive em
 *   opauth-config.yml com senhas hashed.
 */
public class OpAuthPlugin extends JavaPlugin implements Listener {

    private FileConfiguration cfg;
    private File cfgFile;

    /** Players autenticados nesta sessão (UUID) */
    private final Set<UUID> authenticated = ConcurrentHashMap.newKeySet();

    @Override
    public void onEnable() {
        loadConfig();
        getServer().getPluginManager().registerEvents(this, this);

        // Defensiva: se alguém está online com op (carregou de ops.json antes desse plugin),
        // revoga. Isso só roda no caso de /reload, na inicialização normal não tem ninguém online.
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (p.isOp()) p.setOp(false);
        }

        getLogger().info("OpAuthPlugin enabled · " + cfg.getKeys(false).size() + " OPs registrados");
    }

    // ──────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        // Sempre revoga op no join. Mesmo que ops.json diga que é op.
        if (p.isOp()) {
            Bukkit.getScheduler().runTask(this, () -> p.setOp(false));
        }
        // Se está registrado, avisa
        if (cfg.contains(p.getUniqueId().toString())) {
            Bukkit.getScheduler().runTaskLater(this, () -> {
                if (p.isOnline()) {
                    p.sendMessage(Component.text()
                        .append(Component.text("[OpAuth] ", NamedTextColor.GOLD, TextDecoration.BOLD))
                        .append(Component.text("Use ", NamedTextColor.GRAY))
                        .append(Component.text("/opauth <senha>", NamedTextColor.YELLOW))
                        .append(Component.text(" pra autenticar.", NamedTextColor.GRAY))
                        .build());
                }
            }, 30L);  // 1.5s depois — fica depois do welcome
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        Player p = e.getPlayer();
        UUID id = p.getUniqueId();
        if (authenticated.remove(id) && p.isOp()) {
            p.setOp(false);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Commands
    // ──────────────────────────────────────────────────────────────────

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] args) {
        return switch (cmd.getName().toLowerCase()) {
            case "opauth"          -> cmdAuth(s, args);
            case "opauth-set"      -> cmdSet(s, args);
            case "opauth-register" -> cmdRegister(s, args);
            case "opauth-list"     -> cmdList(s);
            case "opauth-remove"   -> cmdRemove(s, args);
            default                -> false;
        };
    }

    private boolean cmdAuth(CommandSender s, String[] args) {
        if (!(s instanceof Player p)) return reply(s, "Só player.", NamedTextColor.RED);
        if (args.length != 1) return reply(p, "Uso: /opauth <senha>", NamedTextColor.RED);
        UUID id = p.getUniqueId();
        String stored = cfg.getString(id.toString() + ".hash");
        if (stored == null) {
            // Sem entrada — silencioso (não revela se UUID está registrado ou não)
            return reply(p, "Senha incorreta.", NamedTextColor.RED);
        }
        String tryHash = hash(args[0], id);
        if (!stored.equals(tryHash)) {
            getLogger().warning("[OpAuth] Tentativa falha de " + p.getName() + " (" + id + ")");
            return reply(p, "Senha incorreta.", NamedTextColor.RED);
        }
        p.setOp(true);
        authenticated.add(id);
        getLogger().info("[OpAuth] " + p.getName() + " autenticado.");
        return reply(p, "✓ Autenticado. OP concedido pra esta sessão.", NamedTextColor.GREEN);
    }

    private boolean cmdSet(CommandSender s, String[] args) {
        if (!(s instanceof Player p)) return reply(s, "Só player.", NamedTextColor.RED);
        if (!authenticated.contains(p.getUniqueId())) {
            return reply(p, "Você precisa estar autenticado pra mudar a senha (/opauth primeiro).", NamedTextColor.RED);
        }
        if (args.length != 1) return reply(p, "Uso: /opauth-set <nova_senha>", NamedTextColor.RED);
        String key = p.getUniqueId().toString();
        cfg.set(key + ".name", p.getName());
        cfg.set(key + ".hash", hash(args[0], p.getUniqueId()));
        persistOpAuthConfig();
        return reply(p, "✓ Senha atualizada.", NamedTextColor.GREEN);
    }

    private boolean cmdRegister(CommandSender s, String[] args) {
        if (!(s instanceof ConsoleCommandSender)) {
            return reply(s, "Esse comando só roda do console (segurança).", NamedTextColor.RED);
        }
        if (args.length != 2) return reply(s, "Uso: /opauth-register <player> <senha_inicial>", NamedTextColor.RED);
        OfflinePlayer op = Bukkit.getOfflinePlayer(args[0]);
        if (op == null || op.getUniqueId() == null) {
            return reply(s, "Player não encontrado: " + args[0], NamedTextColor.RED);
        }
        UUID id = op.getUniqueId();
        cfg.set(id.toString() + ".name", args[0]);
        cfg.set(id.toString() + ".hash", hash(args[1], id));
        persistOpAuthConfig();
        getLogger().info("[OpAuth] " + args[0] + " (" + id + ") registrado como OP.");
        return reply(s, "✓ " + args[0] + " registrado. Senha inicial setada.", NamedTextColor.GREEN);
    }

    private boolean cmdList(CommandSender s) {
        if (!(s instanceof ConsoleCommandSender)) {
            return reply(s, "Só do console.", NamedTextColor.RED);
        }
        s.sendMessage(Component.text("=== OPs registrados ===", NamedTextColor.GOLD));
        for (String key : cfg.getKeys(false)) {
            String name = cfg.getString(key + ".name", "?");
            boolean online = false;
            try {
                Player p = Bukkit.getPlayer(UUID.fromString(key));
                online = p != null && p.isOnline();
                if (online && authenticated.contains(p.getUniqueId())) name += " §a[AUTH]";
                else if (online) name += " §7[online · not authed]";
            } catch (IllegalArgumentException ignored) {}
            s.sendMessage(Component.text("  " + name + " (" + key + ")", NamedTextColor.GRAY));
        }
        return true;
    }

    private boolean cmdRemove(CommandSender s, String[] args) {
        if (!(s instanceof ConsoleCommandSender)) {
            return reply(s, "Só do console.", NamedTextColor.RED);
        }
        if (args.length != 1) return reply(s, "Uso: /opauth-remove <player>", NamedTextColor.RED);
        OfflinePlayer op = Bukkit.getOfflinePlayer(args[0]);
        if (op == null || op.getUniqueId() == null) return reply(s, "Player não encontrado.", NamedTextColor.RED);
        cfg.set(op.getUniqueId().toString(), null);
        persistOpAuthConfig();
        Player online = Bukkit.getPlayer(op.getUniqueId());
        if (online != null) {
            online.setOp(false);
            authenticated.remove(op.getUniqueId());
        }
        return reply(s, "✓ " + args[0] + " removido do OpAuth.", NamedTextColor.GREEN);
    }

    // ──────────────────────────────────────────────────────────────────
    // Hashing
    // ──────────────────────────────────────────────────────────────────

    private static String hash(String password, UUID salt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] bytes = md.digest((password + salt).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Config IO
    // ──────────────────────────────────────────────────────────────────

    private void loadConfig() {
        cfgFile = new File(getDataFolder(), "opauth-config.yml");
        if (!cfgFile.exists()) {
            getDataFolder().mkdirs();
            try { cfgFile.createNewFile(); } catch (IOException e) { getLogger().warning(e.getMessage()); }
        }
        cfg = YamlConfiguration.loadConfiguration(cfgFile);
    }

    private void persistOpAuthConfig() {
        try { cfg.save(cfgFile); } catch (IOException e) { getLogger().warning("Falha salvando opauth: " + e); }
    }

    // ──────────────────────────────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────────────────────────────

    private static boolean reply(CommandSender s, String msg, NamedTextColor color) {
        s.sendMessage(Component.text(msg, color));
        return true;
    }
}
