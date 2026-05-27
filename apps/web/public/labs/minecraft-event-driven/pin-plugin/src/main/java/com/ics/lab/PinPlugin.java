package com.ics.lab;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import net.kyori.adventure.title.Title;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * PinPlugin — anti-scanbot.
 *
 * Princípio de design: o bot NÃO PODE descobrir o PIN observando.
 *   • Zero menção a "PIN" em chat ou title
 *   • Zero feedback de PIN errado (apenas silêncio)
 *   • Title genérico "ICS" sem instrução
 *   • Membros ICS já sabem o código de antemão (passado fora do servidor)
 *
 * Lock behavior:
 *   • Join → spectator + tp pra y=-200 (void)
 *   • Chat & commands cancelados (sem feedback)
 *   • Imune a dano (EntityDamageEvent)
 *   • Se respawnar de algum jeito, re-engaja
 *
 * Unlock behavior:
 *   • Digita "6769" no chat OR "/pin 6769"
 *   • Teleporta pro SPAWN DO MUNDO (não pra última loc)
 *   • Restaura gamemode original
 *   • Zero menção a unlock no chat
 */
public class PinPlugin extends JavaPlugin implements Listener {

    private static final String PIN = "6769";
    private static final int VOID_Y = -200;

    private final Set<UUID> locked = ConcurrentHashMap.newKeySet();
    private final Map<UUID, GameMode> originalGameMode = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("PinPlugin enabled (silent mode)");
    }

    // ──────────────────────────────────────────────────────────────────
    // Lock no join (silencioso)
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.HIGH)
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        UUID id = p.getUniqueId();

        originalGameMode.put(id, p.getGameMode());
        locked.add(id);

        p.setGameMode(GameMode.SPECTATOR);
        Location voidLoc = p.getLocation().clone();
        voidLoc.setY(VOID_Y);
        p.teleport(voidLoc);

        // Title genérico sem revelar nada
        showLockTitle(p);
        Bukkit.getScheduler().runTaskTimer(this, () -> {
            if (locked.contains(id) && p.isOnline()) {
                showLockTitle(p);
            }
        }, 20L * 50, 20L * 50);

        getLogger().info("[Lock] " + p.getName() + " (" + id + ") trancado");
    }

    private void showLockTitle(Player p) {
        // Title minimalista — sem instrução, sem hint, só a marca
        p.showTitle(Title.title(
            Component.text("ICS", NamedTextColor.DARK_RED, TextDecoration.BOLD),
            Component.empty(),
            Title.Times.times(Duration.ofMillis(300), Duration.ofSeconds(50), Duration.ofMillis(500))
        ));
    }

    // ──────────────────────────────────────────────────────────────────
    // Chat: SILENCIOSO. Cancela tudo. Se for o PIN, destrava sem feedback
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST)
    public void onChat(AsyncChatEvent e) {
        Player p = e.getPlayer();
        if (!locked.contains(p.getUniqueId())) return;

        e.setCancelled(true);

        String msg = PlainTextComponentSerializer.plainText().serialize(e.message()).trim();
        if (PIN.equals(msg)) {
            Bukkit.getScheduler().runTask(this, () -> unlock(p));
        }
        // PIN errado: silêncio. Nenhuma resposta. Bot não tem o que medir.
    }

    // ──────────────────────────────────────────────────────────────────
    // Commands: SILENCIOSO. Cancela tudo
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST)
    public void onCommand(PlayerCommandPreprocessEvent e) {
        Player p = e.getPlayer();
        if (!locked.contains(p.getUniqueId())) return;

        String cmd = e.getMessage().trim().toLowerCase();

        // /pin <pin> destrava silenciosamente se correto
        if (cmd.equals("/pin " + PIN)) {
            e.setCancelled(true);
            unlock(p);
            return;
        }

        // Qualquer outro comando (inclusive /pin errado): cancela sem feedback
        e.setCancelled(true);
    }

    // ──────────────────────────────────────────────────────────────────
    // /pin como CommandExecutor (backup)
    // ──────────────────────────────────────────────────────────────────

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player p)) return true;
        if (!locked.contains(p.getUniqueId())) return true;
        if (args.length == 1 && PIN.equals(args[0])) {
            unlock(p);
        }
        // PIN errado: silêncio
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Imunidade a dano enquanto trancado
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent e) {
        if (!(e.getEntity() instanceof Player p)) return;
        if (!locked.contains(p.getUniqueId())) return;
        e.setCancelled(true);
    }

    // ──────────────────────────────────────────────────────────────────
    // Re-engaja void no respawn
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onRespawn(PlayerRespawnEvent e) {
        Player p = e.getPlayer();
        if (!locked.contains(p.getUniqueId())) return;
        Location voidLoc = e.getRespawnLocation().clone();
        voidLoc.setY(VOID_Y);
        e.setRespawnLocation(voidLoc);
        Bukkit.getScheduler().runTask(this, () -> {
            if (locked.contains(p.getUniqueId())) {
                p.setGameMode(GameMode.SPECTATOR);
                showLockTitle(p);
            }
        });
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        locked.remove(id);
        originalGameMode.remove(id);
    }

    // ──────────────────────────────────────────────────────────────────
    // Unlock → spawn do MUNDO (não última loc) + gamemode original
    // ──────────────────────────────────────────────────────────────────

    private void unlock(Player p) {
        UUID id = p.getUniqueId();
        if (!locked.remove(id)) return;

        GameMode mode = originalGameMode.remove(id);
        if (mode != null) p.setGameMode(mode);

        // Bots de stress test ("Bot###") vão pra uma região contida (bot pen)
        // pra concentrar os packets visualmente e não bagunçar a lobby.
        // Players reais vão pro spawn custom do IcsEssentials (com yaw/pitch
        // preservados), com fallback pro worldSpawn se o plugin não tiver
        // setado.
        Location dest;
        if (p.getName().matches("Bot\\d+")) {
            double x = 37 + Math.random() * 30;
            double z = 38 + Math.random() * 28;
            dest = new Location(p.getWorld(), x, 8, z);
        } else {
            dest = resolveSpawn(p);
        }
        p.teleport(dest);

        // Clear title (sem mensagem de "unlocked" — neutralidade total)
        p.clearTitle();
        getLogger().info("[Unlock] " + p.getName() + " (" + id + ") destrancou");
    }

    /**
     * Tenta usar o spawn do IcsEssentials (com yaw/pitch). Fallback: worldSpawn.
     * Sem hard dependency entre plugins — só usa se IcsEssentials estiver carregado.
     */
    private Location resolveSpawn(Player p) {
        org.bukkit.plugin.Plugin ess = Bukkit.getPluginManager().getPlugin("IcsEssentials");
        if (ess != null && ess.isEnabled()) {
            try {
                java.lang.reflect.Method m = ess.getClass().getMethod("getCustomSpawn", org.bukkit.World.class);
                Object result = m.invoke(ess, p.getWorld());
                if (result instanceof Location loc) return loc;
            } catch (ReflectiveOperationException ignored) {}
        }
        return p.getWorld().getSpawnLocation();
    }
}
