import java.lang.reflect.Constructor;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.jar.JarFile;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.tree.*;
import org.objectweb.asm.tree.analysis.*;
import org.spongepowered.asm.launch.MixinBootstrap;
import org.spongepowered.asm.mixin.*;
import org.spongepowered.asm.mixin.transformer.IMixinTransformer;

/** Apply the shipped client Mixins to the supplied unmodified DCP classes. */
public final class ApplyBoundsMixins {
    public static void main(String[] args) throws Exception {
        MixinBootstrap.init();
        MixinEnvironment environment = MixinEnvironment.getDefaultEnvironment();
        environment.setSide(MixinEnvironment.Side.CLIENT);
        Mixins.addConfiguration("create-style-dyson-compat.mixins.json");
        Constructor<?> constructor = Class.forName("org.spongepowered.asm.mixin.transformer.MixinTransformer").getDeclaredConstructor();
        constructor.setAccessible(true);
        IMixinTransformer transformer = (IMixinTransformer) constructor.newInstance();
        String[] targets = { "EMRailEjectorBlockEntity", "RayReceiverBlockEntity" };
        for (String name : targets) {
            String target = "org/mob/dysoncubeproject/block/entity/" + name;
            byte[] original;
            try (JarFile jar = new JarFile(args[0])) {
                original = jar.getInputStream(jar.getJarEntry(target + ".class")).readAllBytes();
            }
            byte[] result = transformer.transformClass(environment, target.replace('/', '.'), original);
            if (Arrays.equals(original, result)) throw new AssertionError("Mixin did not transform " + name);
            ClassNode node = new ClassNode();
            new ClassReader(result).accept(node, 0);
            int boundsHandler = 0, originalAabb = 0, cacheExpand = 0, cacheConstructors = 0;
            for (MethodNode method : node.methods) {
                for (AbstractInsnNode instruction : method.instructions) {
                    if (!(instruction instanceof MethodInsnNode call)) continue;
                    if (method.name.equals("getRenderBoundingBox") && call.owner.equals(target) && call.name.contains("renderBounds")) boundsHandler++;
                    if (method.name.equals("getRenderBoundingBox") && call.name.equals("getAABB")) originalAabb++;
                    if (method.name.contains("renderBounds") && call.owner.equals("dev/eldershi/dysoncompat/client/RenderBoundsCache") && call.name.equals("expand")) cacheExpand++;
                    if (method.name.equals("<init>") && call.owner.equals("dev/eldershi/dysoncompat/client/RenderBoundsCache") && call.name.equals("<init>")) cacheConstructors++;
                }
                if (method.instructions.size() > 0) new Analyzer<BasicValue>(new BasicVerifier()).analyze(node.name, method);
            }
            if (boundsHandler != 1 || originalAabb != 1 || cacheExpand != 1 || cacheConstructors < 1)
                throw new AssertionError("Unexpected transformed shape " + name + ": " + boundsHandler + "/" + originalAabb + "/" + cacheExpand + "/" + cacheConstructors);
            Files.write(Path.of(args[1], name + ".class"), result);
            System.out.println("REAL_MIXIN_PASS " + name + ": original bounds preserved, one RETURN union, per-instance cache initializer; ASM verifier passed");
        }
        String target = "net/minecraft/client/resources/model/ModelManager";
        byte[] original;
        try (JarFile jar = new JarFile(args[2])) {
            original = jar.getInputStream(jar.getJarEntry(target + ".class")).readAllBytes();
        }
        byte[] result = transformer.transformClass(environment, target.replace('/', '.'), original);
        if (Arrays.equals(original, result)) throw new AssertionError("Model preparation mixin did not transform target");
        ClassNode node = new ClassNode();
        new ClassReader(result).accept(node, 0);
        int headCalls = 0, prepareCalls = 0;
        for (MethodNode method : node.methods) {
            MethodInsnNode first = null;
            for (AbstractInsnNode instruction : method.instructions) {
                if (!(instruction instanceof MethodInsnNode call)) continue;
                if (first == null && !call.owner.startsWith("org/spongepowered/asm/mixin/injection/callback/")) first = call;
                if (method.name.equals("m_5540_") && call.name.contains("prepareObjResources")) headCalls++;
                if (method.name.contains("prepareObjResources") && call.owner.equals("dev/eldershi/dysoncompat/client/ApprovedVisuals")
                    && call.name.equals("onModelPreparation")) prepareCalls++;
            }
            if (method.name.equals("m_5540_") && (first == null || !first.name.contains("prepareObjResources")))
                throw new AssertionError("OBJ binding must precede all asynchronous prepare work");
            if (method.instructions.size() > 0) new Analyzer<BasicValue>(new BasicVerifier()).analyze(node.name, method);
        }
        if (headCalls != 1 || prepareCalls != 1) throw new AssertionError("Unexpected OBJ preparation injection count");
        Files.write(Path.of(args[1], "ModelManager.class"), result);
        System.out.println("REAL_MIXIN_PASS ModelManager: one scoped OBJ reload binding before asynchronous model preparation; ASM verifier passed");

        applyLifecycle(transformer, environment, args[2], args[1], "net/minecraft/world/level/block/entity/BlockEntity",
            new String[] {"m_6339_", "m_7651_", "onChunkUnloaded"}, new String[] {"registerGlobalRenderer", "removeGlobalRenderer", "removeGlobalRenderer"});
        applyLifecycle(transformer, environment, args[2], args[1], "net/minecraft/client/renderer/LevelRenderer",
            new String[] {"m_109818_", "m_109701_"}, new String[] {"restoreGlobals", "changeWorld"});
        if (args.length > 3 && !args[3].equals("-")) {
            applyLifecycle(transformer, environment, args[3], args[1], "me/jellysquid/mods/sodium/client/render/chunk/data/BuiltSectionInfo$Builder",
                new String[] {"addBlockEntity"}, new String[] {"nativeGlobalOwner"});
        }
    }

    private static void applyLifecycle(IMixinTransformer transformer, MixinEnvironment environment, String jarPath,
            String destination, String target, String[] methods, String[] handlers) throws Exception {
        byte[] original;
        try (JarFile jar = new JarFile(jarPath)) {
            original = jar.getInputStream(jar.getJarEntry(target + ".class")).readAllBytes();
        }
        byte[] result = transformer.transformClass(environment, target.replace('/', '.'), original);
        if (Arrays.equals(original, result)) throw new AssertionError("Lifecycle target not transformed: " + target);
        ClassNode node = new ClassNode();
        new ClassReader(result).accept(node, 0);
        int[] calls = new int[methods.length];
        for (MethodNode method : node.methods) {
            for (AbstractInsnNode instruction : method.instructions) {
                if (!(instruction instanceof MethodInsnNode call)) continue;
                for (int i = 0; i < methods.length; i++) {
                    if (method.name.equals(methods[i]) && call.owner.equals(target) && call.name.contains(handlers[i])) calls[i]++;
                }
            }
            if (method.instructions.size() > 0) new Analyzer<BasicValue>(new BasicVerifier()).analyze(node.name, method);
        }
        for (int i = 0; i < calls.length; i++) if (calls[i] != 1)
            throw new AssertionError("Unexpected lifecycle hook count " + methods[i] + ": " + calls[i]);
        Files.write(Path.of(destination, target.substring(target.lastIndexOf('/') + 1) + ".class"), result);
        System.out.println("REAL_MIXIN_PASS " + target + ": exact lifecycle/native ownership hooks; ASM verifier passed");
    }
}
