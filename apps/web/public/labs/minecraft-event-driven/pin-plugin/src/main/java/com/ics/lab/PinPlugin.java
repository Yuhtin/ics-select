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
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * PinPlugin — protege o servidor de scan bots da internet.
 *
 * Toda conta que entra é travada: gamemode spectator + teleport pra y=-200
 * (void aparente, sem dano). Chat e comandos ficam bloqueados, exceto
 * digitar "6769" no chat ou rodar "/pin 6769". Aí o player é destravado,
 * volta pro gamemode e local original.
 *
 * Modelo de ameaça: scan bots geralmente listam servidores via SLP (Status)
 * mas não autenticam. Mesmo se conseguirem login (online-mode=false), o
 * primeiro impacto deles é zero — não conseguem mexer no mundo nem mandar
 * comando até inserirem o PIN. Pra aula presencial, basta avisar a turma
 * que o código é 6769.
 *
 * Limitações honestas:
 *   - PIN hardcoded no source · pra um lab tudo bem; em produção viria de config
 *   - Não criptografa nem hash do PIN (texto puro na memória)
 *   - Player pode ser detectado pelo nick em outro servidor — outra camada
 */
public class PinPlugin extends JavaPlugin implements Listener {

    private static final String PIN = "6769";
    private static final int VOID_Y = -200;

    /** Players atualmente trancados (cleared on unlock/quit). */
    private final Set<UUID> locked = ConcurrentHashMap.newKeySet();

    /** Estado original pra restaurar quando o PIN for aceito. */
    private final Map<UUID, Location> originalLocation = new ConcurrentHashMap<>();
    private final Map<UUID, GameMode> originalGameMode = new ConcurrentHashMap<>();

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("PinPlugin enabled · PIN=" + PIN + " · todos os joins serão travados até digitar");
    }

    // ──────────────────────────────────────────────────────────────────
    // Lock no join (HIGH priority pra rodar depois de plugins que setam
    // posição inicial, mas antes de plugins que dependem do gameplay)
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.HIGH)
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        UUID id = p.getUniqueId();

        // Salva estado original
        originalLocation.put(id, p.getLocation().clone());
        originalGameMode.put(id, p.getGameMode());

        // Trava
        locked.add(id);

        // Spectator: sem dano, sem interação, sem colisão
        p.setGameMode(GameMode.SPECTATOR);

        // Teleporta pro void
        Location voidLoc = p.getLocation().clone();
        voidLoc.setY(VOID_Y);
        p.teleport(voidLoc);

        // Title cobrindo a tela (60s, depois precisa renovar)
        showLockTitle(p);

        // Agenda renovação do title a cada 50s (Bukkit limita o stay máximo)
        Bukkit.getScheduler().runTaskTimer(this, () -> {
            if (locked.contains(id) && p.isOnline()) {
                showLockTitle(p);
            }
        }, 20L * 50, 20L * 50);

        // Mensagem no chat também
        p.sendMessage(Component.text()
            .append(Component.text("[PIN] ", NamedTextColor.RED, TextDecoration.BOLD))
            .append(Component.text("Servidor travado. Digite ", NamedTextColor.GRAY))
            .append(Component.text("/pin 6769", NamedTextColor.GREEN))
            .append(Component.text(" ou só ", NamedTextColor.GRAY))
            .append(Component.text("6769", NamedTextColor.GREEN))
            .append(Component.text(" no chat.", NamedTextColor.GRAY))
            .build()
        );

        getLogger().info("[Lock] " + p.getName() + " (" + id + ") trancado no void");
    }

    private void showLockTitle(Player p) {
        p.showTitle(Title.title(
            Component.text("PIN REQUIRED", NamedTextColor.DARK_RED, TextDecoration.BOLD),
            Component.text("Digite /pin 6769 ou 6769 no chat", NamedTextColor.GRAY),
            Title.Times.times(Duration.ofMillis(300), Duration.ofSeconds(50), Duration.ofMillis(500))
        ));
    }

    // ──────────────────────────────────────────────────────────────────
    // Bloqueio de chat (única forma de entrar o PIN sem comando)
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST)
    public void onChat(AsyncChatEvent e) {
        Player p = e.getPlayer();
        if (!locked.contains(p.getUniqueId())) return;

        // Sempre cancela: trancados não falam no chat
        e.setCancelled(true);

        String msg = PlainTextComponentSerializer.plainText().serialize(e.message()).trim();
        if (PIN.equals(msg)) {
            // Async event · agenda no main thread pra mexer no player
            Bukkit.getScheduler().runTask(this, () -> unlock(p));
        } else {
            // Feedback (sync ou async ambos OK pra sendMessage)
            p.sendMessage(Component.text("[PIN] PIN incorreto. Use /pin 6769", NamedTextColor.RED));
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Bloqueio de TODOS os comandos exceto /pin
    // ──────────────────────────────────────────────────────────────────

    @EventHandler(priority = EventPriority.LOWEST)
    public void onCommand(PlayerCommandPreprocessEvent e) {
        Player p = e.getPlayer();
        if (!locked.contains(p.getUniqueId())) return;

        String cmd = e.getMessage().trim().toLowerCase();

        if (cmd.equals("/pin " + PIN)) {
            e.setCancelled(true);
            unlock(p);
            return;
        }

        if (cmd.startsWith("/pin")) {
            e.setCancelled(true);
            p.sendMessage(Component.text("[PIN] PIN incorreto. Use /pin 6769", NamedTextColor.RED));
            return;
        }

        // Qualquer outro comando: bloqueia
        e.setCancelled(true);
        p.sendMessage(Component.text("[PIN] Digite o PIN primeiro: /pin 6769", NamedTextColor.RED));
    }

    // ──────────────────────────────────────────────────────────────────
    // Implementação do /pin como CommandExecutor
    // (caso o PlayerCommandPreprocessEvent não bata por algum motivo)
    // ──────────────────────────────────────────────────────────────────

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player p)) {
            sender.sendMessage("Esse comando só funciona pra player.");
            return true;
        }
        if (!locked.contains(p.getUniqueId())) {
            p.sendMessage(Component.text("Você já está desbloqueado.", NamedTextColor.GRAY));
            return true;
        }
        if (args.length == 1 && PIN.equals(args[0])) {
            unlock(p);
        } else {
            p.sendMessage(Component.text("[PIN] PIN incorreto.", NamedTextColor.RED));
        }
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Cleanup no quit
    // ──────────────────────────────────────────────────────────────────

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        locked.remove(id);
        originalLocation.remove(id);
        originalGameMode.remove(id);
    }

    // ──────────────────────────────────────────────────────────────────
    // Unlock — sempre no main thread
    // ──────────────────────────────────────────────────────────────────

    private void unlock(Player p) {
        UUID id = p.getUniqueId();
        if (!locked.remove(id)) return;

        GameMode mode = originalGameMode.remove(id);
        Location loc = originalLocation.remove(id);

        if (mode != null) p.setGameMode(mode);
        if (loc != null) p.teleport(loc);

        p.showTitle(Title.title(
            Component.text("UNLOCKED", NamedTextColor.GREEN, TextDecoration.BOLD),
            Component.text("Bem-vindo ao ICS Lab", NamedTextColor.GRAY),
            Title.Times.times(Duration.ofMillis(300), Duration.ofSeconds(2), Duration.ofMillis(500))
        ));
        p.sendMessage(Component.text("[PIN] PIN aceito. Bem-vindo!", NamedTextColor.GREEN));

        getLogger().info("[Unlock] " + p.getName() + " (" + id + ") destrancou");
    }
}
