package com.ics.lab;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IcsEssentials — pacote mínimo de comandos QoL pro ICS Lab.
 *
 * Stateless onde dá pra ser (broadcast, gamemode, heal, fly).
 * Stateful com persistência em YAML: /sethome /home (homes.yml).
 * Stateful em memória: /tpa pending requests, /msg último contato, /vanish list.
 *
 * Decisões de design:
 *   • Sem dependência externa (sem Vault, sem PlaceholderAPI)
 *   • Adventure API pra mensagens
 *   • Permissions só pra comandos admin (ics.admin)
 *   • Comandos de player (spawn, home, msg, tpa) liberados pra todos
 *   • /vanish usa PotionEffect.INVISIBILITY + esconde da tab list
 */
public class IcsEssentials extends JavaPlugin implements Listener {

    private static final long TPA_TIMEOUT_MS = 60_000L;

    private FileConfiguration homesConfig;
    private File homesFile;

    private FileConfiguration spawnConfig;
    private File spawnFile;

    /** Pedidos de TPA pendentes: target → requester */
    private final Map<UUID, PendingTpa> pendingTpas = new ConcurrentHashMap<>();
    /** Última pessoa que mandou DM pra cada player (pra /r responder) */
    private final Map<UUID, UUID> lastDm = new ConcurrentHashMap<>();
    /** Players vanish'ed */
    private final java.util.Set<UUID> vanished = ConcurrentHashMap.newKeySet();

    private record PendingTpa(UUID requesterId, long expiresAt) {}

    @Override
    public void onEnable() {
        getServer().getPluginManager().registerEvents(this, this);
        loadHomes();
        loadSpawn();
        getLogger().info("IcsEssentials enabled");
    }

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] args) {
        String name = cmd.getName().toLowerCase();
        return switch (name) {
            // Player commands
            case "spawn"     -> cmdSpawn(s);
            case "setspawn"  -> cmdSetSpawn(s);
            case "sethome"   -> cmdSetHome(s);
            case "home"      -> cmdHome(s);
            case "delhome"   -> cmdDelHome(s);
            case "tpa"       -> cmdTpa(s, args);
            case "tpaccept"  -> cmdTpAccept(s);
            case "tpdeny"    -> cmdTpDeny(s);
            case "msg"       -> cmdMsg(s, args);
            case "r"         -> cmdReply(s, args);
            // Admin commands
            case "heal"      -> cmdHeal(s, args);
            case "feed"      -> cmdFeed(s, args);
            case "fly"       -> cmdFly(s, args);
            case "gmc"       -> cmdGm(s, args, GameMode.CREATIVE);
            case "gms"       -> cmdGm(s, args, GameMode.SURVIVAL);
            case "gma"       -> cmdGm(s, args, GameMode.ADVENTURE);
            case "gmsp"      -> cmdGm(s, args, GameMode.SPECTATOR);
            case "broadcast" -> cmdBroadcast(s, args);
            case "vanish"    -> cmdVanish(s);
            case "day"       -> cmdTime(s, 1000);
            case "night"     -> cmdTime(s, 13000);
            case "sun"       -> cmdWeather(s, false);
            case "rain"      -> cmdWeather(s, true);
            default          -> false;
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // /spawn (usa custom spawn com yaw/pitch · fallback pro worldSpawn)
    // ──────────────────────────────────────────────────────────────────
    private boolean cmdSpawn(CommandSender s) {
        if (!(s instanceof Player p)) { reply(s, "Só player.", NamedTextColor.RED); return true; }
        Location dest = customSpawn();
        if (dest == null) dest = p.getWorld().getSpawnLocation();
        p.teleport(dest);
        reply(p, "Você foi pro spawn.", NamedTextColor.GREEN);
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // /setspawn — admin · grava x/y/z/yaw/pitch em precisão dupla
    // ──────────────────────────────────────────────────────────────────
    private boolean cmdSetSpawn(CommandSender s) {
        if (!(s instanceof Player p)) { reply(s, "Só player.", NamedTextColor.RED); return true; }
        if (!p.hasPermission("ics.admin")) { reply(p, "Sem permissão.", NamedTextColor.RED); return true; }
        Location loc = p.getLocation();
        spawnConfig.set("world", loc.getWorld().getName());
        spawnConfig.set("x", loc.getX());
        spawnConfig.set("y", loc.getY());
        spawnConfig.set("z", loc.getZ());
        spawnConfig.set("yaw", (double) loc.getYaw());
        spawnConfig.set("pitch", (double) loc.getPitch());
        saveSpawn();
        // Atualiza também o worldSpawn vanilla pro respawn padrão / PinPlugin unlock,
        // mas a precisão fina (yaw/pitch) só fica no nosso config
        loc.getWorld().setSpawnLocation(loc);
        reply(p, String.format("Spawn setado em x=%.3f y=%.3f z=%.3f yaw=%.2f pitch=%.2f",
            loc.getX(), loc.getY(), loc.getZ(), loc.getYaw(), loc.getPitch()), NamedTextColor.GREEN);
        return true;
    }

    /** Loc precisa armazenada — null se nunca foi setada. */
    private Location customSpawn() {
        if (!spawnConfig.contains("world")) return null;
        World w = Bukkit.getWorld(spawnConfig.getString("world", "world"));
        if (w == null) return null;
        return new Location(w,
            spawnConfig.getDouble("x"),
            spawnConfig.getDouble("y"),
            spawnConfig.getDouble("z"),
            (float) spawnConfig.getDouble("yaw"),
            (float) spawnConfig.getDouble("pitch"));
    }

    /** Exposto pra outros plugins (ex: PinPlugin unlock) que querem o spawn correto. */
    public Location getCustomSpawn(World fallback) {
        Location loc = customSpawn();
        return loc != null ? loc : fallback.getSpawnLocation();
    }

    // ──────────────────────────────────────────────────────────────────
    // /sethome /home /delhome (YAML-backed)
    // ──────────────────────────────────────────────────────────────────
    private boolean cmdSetHome(CommandSender s) {
        if (!(s instanceof Player p)) return false;
        Location loc = p.getLocation();
        String key = p.getUniqueId().toString();
        homesConfig.set(key + ".world", loc.getWorld().getName());
        homesConfig.set(key + ".x", loc.getX());
        homesConfig.set(key + ".y", loc.getY());
        homesConfig.set(key + ".z", loc.getZ());
        homesConfig.set(key + ".yaw", loc.getYaw());
        homesConfig.set(key + ".pitch", loc.getPitch());
        saveHomes();
        reply(p, "Home setado aqui.", NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdHome(CommandSender s) {
        if (!(s instanceof Player p)) return false;
        String key = p.getUniqueId().toString();
        if (!homesConfig.contains(key)) {
            reply(p, "Você não tem home. Use /sethome.", NamedTextColor.RED);
            return true;
        }
        World w = Bukkit.getWorld(homesConfig.getString(key + ".world", "world"));
        if (w == null) { reply(p, "Mundo do home não existe.", NamedTextColor.RED); return true; }
        Location loc = new Location(w,
            homesConfig.getDouble(key + ".x"),
            homesConfig.getDouble(key + ".y"),
            homesConfig.getDouble(key + ".z"),
            (float) homesConfig.getDouble(key + ".yaw"),
            (float) homesConfig.getDouble(key + ".pitch"));
        p.teleport(loc);
        reply(p, "Você foi pro seu home.", NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdDelHome(CommandSender s) {
        if (!(s instanceof Player p)) return false;
        String key = p.getUniqueId().toString();
        if (!homesConfig.contains(key)) { reply(p, "Você não tem home.", NamedTextColor.RED); return true; }
        homesConfig.set(key, null);
        saveHomes();
        reply(p, "Home removido.", NamedTextColor.GREEN);
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // /tpa /tpaccept /tpdeny
    // ──────────────────────────────────────────────────────────────────
    private boolean cmdTpa(CommandSender s, String[] args) {
        if (!(s instanceof Player p)) return false;
        if (args.length != 1) { reply(p, "Uso: /tpa <player>", NamedTextColor.RED); return true; }
        Player target = Bukkit.getPlayerExact(args[0]);
        if (target == null || target.equals(p)) { reply(p, "Player não encontrado.", NamedTextColor.RED); return true; }

        pendingTpas.put(target.getUniqueId(), new PendingTpa(p.getUniqueId(), System.currentTimeMillis() + TPA_TIMEOUT_MS));
        reply(p, "Pedido enviado pra " + target.getName() + ". Expira em 60s.", NamedTextColor.GREEN);
        target.sendMessage(Component.text()
            .append(Component.text(p.getName(), NamedTextColor.YELLOW))
            .append(Component.text(" pediu pra teleportar até você. ", NamedTextColor.GRAY))
            .append(Component.text("/tpaccept", NamedTextColor.GREEN, TextDecoration.BOLD))
            .append(Component.text(" ou ", NamedTextColor.GRAY))
            .append(Component.text("/tpdeny", NamedTextColor.RED, TextDecoration.BOLD))
            .build());
        return true;
    }

    private boolean cmdTpAccept(CommandSender s) {
        if (!(s instanceof Player target)) return false;
        PendingTpa req = pendingTpas.remove(target.getUniqueId());
        if (req == null || req.expiresAt < System.currentTimeMillis()) {
            reply(target, "Nenhum pedido pendente.", NamedTextColor.RED);
            return true;
        }
        Player requester = Bukkit.getPlayer(req.requesterId);
        if (requester == null) { reply(target, "O player saiu.", NamedTextColor.RED); return true; }
        requester.teleport(target.getLocation());
        reply(requester, "Aceito! Você foi teleportado.", NamedTextColor.GREEN);
        reply(target, requester.getName() + " foi teleportado até você.", NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdTpDeny(CommandSender s) {
        if (!(s instanceof Player target)) return false;
        PendingTpa req = pendingTpas.remove(target.getUniqueId());
        if (req == null) { reply(target, "Nenhum pedido pendente.", NamedTextColor.GRAY); return true; }
        Player requester = Bukkit.getPlayer(req.requesterId);
        if (requester != null) reply(requester, "Seu pedido foi recusado.", NamedTextColor.RED);
        reply(target, "Pedido recusado.", NamedTextColor.GRAY);
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // /msg /r
    // ──────────────────────────────────────────────────────────────────
    private boolean cmdMsg(CommandSender s, String[] args) {
        if (!(s instanceof Player p)) return false;
        if (args.length < 2) { reply(p, "Uso: /msg <player> <mensagem>", NamedTextColor.RED); return true; }
        Player target = Bukkit.getPlayerExact(args[0]);
        if (target == null) { reply(p, "Player não encontrado.", NamedTextColor.RED); return true; }
        String msg = String.join(" ", java.util.Arrays.copyOfRange(args, 1, args.length));
        sendDm(p, target, msg);
        return true;
    }

    private boolean cmdReply(CommandSender s, String[] args) {
        if (!(s instanceof Player p)) return false;
        UUID lastId = lastDm.get(p.getUniqueId());
        if (lastId == null) { reply(p, "Sem DM recente pra responder.", NamedTextColor.RED); return true; }
        Player target = Bukkit.getPlayer(lastId);
        if (target == null) { reply(p, "O último contato saiu.", NamedTextColor.RED); return true; }
        if (args.length == 0) { reply(p, "Uso: /r <mensagem>", NamedTextColor.RED); return true; }
        sendDm(p, target, String.join(" ", args));
        return true;
    }

    private void sendDm(Player from, Player to, String msg) {
        Component fromLine = Component.text()
            .append(Component.text("[me → " + to.getName() + "] ", NamedTextColor.DARK_PURPLE))
            .append(Component.text(msg, NamedTextColor.LIGHT_PURPLE))
            .build();
        Component toLine = Component.text()
            .append(Component.text("[" + from.getName() + " → me] ", NamedTextColor.DARK_PURPLE))
            .append(Component.text(msg, NamedTextColor.LIGHT_PURPLE))
            .build();
        from.sendMessage(fromLine);
        to.sendMessage(toLine);
        lastDm.put(to.getUniqueId(), from.getUniqueId());
        lastDm.put(from.getUniqueId(), to.getUniqueId());
    }

    // ──────────────────────────────────────────────────────────────────
    // Admin: /heal /feed /fly /gm{c,s,a,sp}
    // ──────────────────────────────────────────────────────────────────
    private Player targetOrSelf(CommandSender s, String[] args) {
        if (args.length >= 1) {
            Player t = Bukkit.getPlayerExact(args[0]);
            if (t == null) { reply(s, "Player não encontrado: " + args[0], NamedTextColor.RED); return null; }
            return t;
        }
        if (s instanceof Player p) return p;
        reply(s, "Especifique um player do console.", NamedTextColor.RED);
        return null;
    }

    private boolean cmdHeal(CommandSender s, String[] args) {
        Player t = targetOrSelf(s, args); if (t == null) return true;
        t.setHealth(t.getAttribute(org.bukkit.attribute.Attribute.MAX_HEALTH).getValue());
        t.setFoodLevel(20);
        t.setSaturation(20);
        t.setFireTicks(0);
        reply(s, t.getName() + " curado.", NamedTextColor.GREEN);
        if (!t.equals(s)) reply(t, "Você foi curado.", NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdFeed(CommandSender s, String[] args) {
        Player t = targetOrSelf(s, args); if (t == null) return true;
        t.setFoodLevel(20); t.setSaturation(20);
        reply(s, t.getName() + " alimentado.", NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdFly(CommandSender s, String[] args) {
        Player t = targetOrSelf(s, args); if (t == null) return true;
        boolean enable = !t.getAllowFlight();
        t.setAllowFlight(enable);
        t.setFlying(enable);
        reply(s, t.getName() + " · fly " + (enable ? "ON" : "OFF"), enable ? NamedTextColor.GREEN : NamedTextColor.GRAY);
        return true;
    }

    private boolean cmdGm(CommandSender s, String[] args, GameMode mode) {
        Player t = targetOrSelf(s, args); if (t == null) return true;
        t.setGameMode(mode);
        reply(s, t.getName() + " · gamemode " + mode.name().toLowerCase(), NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdBroadcast(CommandSender s, String[] args) {
        if (args.length == 0) { reply(s, "Uso: /broadcast <mensagem>", NamedTextColor.RED); return true; }
        Bukkit.broadcast(Component.text()
            .append(Component.text("[BROADCAST] ", NamedTextColor.GOLD, TextDecoration.BOLD))
            .append(Component.text(String.join(" ", args), NamedTextColor.YELLOW))
            .build());
        return true;
    }

    private boolean cmdVanish(CommandSender s) {
        if (!(s instanceof Player p)) return false;
        UUID id = p.getUniqueId();
        if (vanished.remove(id)) {
            p.removePotionEffect(PotionEffectType.INVISIBILITY);
            for (Player o : Bukkit.getOnlinePlayers()) o.showPlayer(this, p);
            reply(p, "Vanish OFF.", NamedTextColor.GRAY);
        } else {
            vanished.add(id);
            p.addPotionEffect(new PotionEffect(PotionEffectType.INVISIBILITY, Integer.MAX_VALUE, 1, false, false));
            for (Player o : Bukkit.getOnlinePlayers()) if (!o.isOp()) o.hidePlayer(this, p);
            reply(p, "Vanish ON.", NamedTextColor.GREEN);
        }
        return true;
    }

    private boolean cmdTime(CommandSender s, long ticks) {
        if (!(s instanceof Player p)) { reply(s, "Só player.", NamedTextColor.RED); return true; }
        p.getWorld().setTime(ticks);
        reply(p, "Tempo: " + (ticks < 6000 ? "dia" : "noite"), NamedTextColor.GREEN);
        return true;
    }

    private boolean cmdWeather(CommandSender s, boolean storm) {
        if (!(s instanceof Player p)) { reply(s, "Só player.", NamedTextColor.RED); return true; }
        p.getWorld().setStorm(storm);
        p.getWorld().setThundering(false);
        reply(p, "Clima: " + (storm ? "chuva" : "sol"), NamedTextColor.GREEN);
        return true;
    }

    // ──────────────────────────────────────────────────────────────────
    // Persistência homes.yml
    // ──────────────────────────────────────────────────────────────────
    private void loadHomes() {
        homesFile = new File(getDataFolder(), "homes.yml");
        if (!homesFile.exists()) {
            getDataFolder().mkdirs();
            try { homesFile.createNewFile(); } catch (IOException e) { getLogger().warning("Falha criando homes.yml: " + e); }
        }
        homesConfig = YamlConfiguration.loadConfiguration(homesFile);
    }

    private void saveHomes() {
        try { homesConfig.save(homesFile); } catch (IOException e) { getLogger().warning("Falha salvando homes.yml: " + e); }
    }

    private void loadSpawn() {
        spawnFile = new File(getDataFolder(), "spawn.yml");
        if (!spawnFile.exists()) {
            getDataFolder().mkdirs();
            try { spawnFile.createNewFile(); } catch (IOException e) { getLogger().warning("spawn.yml: " + e); }
        }
        spawnConfig = YamlConfiguration.loadConfiguration(spawnFile);
    }

    private void saveSpawn() {
        try { spawnConfig.save(spawnFile); } catch (IOException e) { getLogger().warning("Falha salvando spawn.yml: " + e); }
    }

    // ──────────────────────────────────────────────────────────────────
    // Cleanup
    // ──────────────────────────────────────────────────────────────────
    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        pendingTpas.remove(id);
        lastDm.remove(id);
        vanished.remove(id);
    }

    // ──────────────────────────────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────────────────────────────
    private static void reply(CommandSender s, String msg, NamedTextColor color) {
        s.sendMessage(Component.text(msg, color));
    }
}
