package dev.eldershi.dysoncompat.client;

import com.mojang.blaze3d.vertex.PoseStack;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Proxy;
import java.util.Optional;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.core.BlockPos;
import net.minecraft.server.packs.resources.Resource;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

/** Standalone native contracts; no game, server, world or launcher is started. */
public final class NativeBoundsRegression {
    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }

    private static void contains(AABB outer, AABB inner) {
        check(outer.f_82288_ <= inner.f_82288_ && outer.f_82289_ <= inner.f_82289_ && outer.f_82290_ <= inner.f_82290_
            && outer.f_82291_ >= inner.f_82291_ && outer.f_82292_ >= inner.f_82292_ && outer.f_82293_ >= inner.f_82293_, "Bounds narrowed");
    }

    private static ResourceManager resources(boolean rail, boolean receiver) {
        return (ResourceManager) Proxy.newProxyInstance(ResourceManager.class.getClassLoader(), new Class<?>[] {ResourceManager.class},
            (proxy, method, arguments) -> {
                if (!method.getName().equals("m_213713_")) throw new AssertionError("Unexpected resource access: " + method);
                String name = arguments[0].toString();
                boolean present = (rail && name.equals("dcp_scripted_rail:models/block/rail_parts.json"))
                    || (receiver && name.equals("dcp_scripted_receiver:models/block/receiver_parts.json"));
                return present ? Optional.of(new Resource(null, () -> new ByteArrayInputStream(new byte[0]))) : Optional.empty();
            });
    }

    public static void main(String[] args) {
        AABB nativeBox = new AABB(-1000, -1000, -1000, 1000, 1000, 1000);
        BlockPos pos = new BlockPos(15, 15, 15);
        RenderBoundsCache rail = new RenderBoundsCache(0, 1.25);
        RenderBoundsCache receiver = new RenderBoundsCache(1, 0);
        check(!ApprovedRendererBridge.isActive(), "Gate must start closed");
        check(!ApprovedRendererBridge.hasPreparedResources(), "Preparation gate must start closed");
        ApprovedVisuals.onModelPreparation(resources(false, false));
        check(!ApprovedRendererBridge.hasPreparedResources(), "An empty reload must clear preparation availability");
        check(!ApprovedVisuals.needsObjPreparation(resources(false, false)), "Unrelated reload must not rebind OBJ loader");
        check(!ApprovedVisuals.needsObjPreparation(resources(true, false)), "One incomplete root must not activate paired resources");
        check(ApprovedVisuals.needsObjPreparation(resources(true, true)), "Pack enable needs OBJ preparation before the active gate flips");
        ApprovedVisuals.updateAvailability(true);
        check(ApprovedVisuals.needsObjPreparation(resources(false, false)), "Pack disable must refresh previously active OBJ state");
        ApprovedVisuals.updateAvailability(false);
        check(rail.expand(nativeBox, pos) == nativeBox, "Disabled resources must preserve native identity");
        long allocations = ApprovedVisuals.MERGED_ALLOCATIONS.get();
        ApprovedVisuals.updateAvailability(true);
        AABB merged = rail.expand(nativeBox, pos);
        contains(merged, nativeBox);
        check(merged.f_82292_ == 1001.25, "Lifted native FX envelope missing");
        check(ApprovedVisuals.MERGED_ALLOCATIONS.get() == allocations + 1, "One cache miss must allocate one union");
        AABB equalNative = new AABB(-1000, -1000, -1000, 1000, 1000, 1000);
        for (int i = 0; i < 10000; i++) check(rail.expand(equalNative, pos) == merged, "Same numeric bounds must reuse union");
        check(ApprovedVisuals.MERGED_ALLOCATIONS.get() == allocations + 1, "Stable frames allocated new unions");
        AABB originalSmall = new AABB(15, 15, 15, 16, 16, 16);
        AABB full = rail.expand(originalSmall, pos);
        double[] envelope = ApprovedVisuals.envelope(0);
        contains(full, new AABB(envelope[0] + 15, envelope[1] + 15, envelope[2] + 15,
            envelope[3] + 15, envelope[4] + 15, envelope[5] + 15));
        contains(full, new AABB(15, 16.25, 15, 16, 17.25, 16));
        AABB moved = rail.expand(originalSmall, new BlockPos(-17, -1, -16));
        check(moved != full, "Position changes must invalidate union");
        contains(moved, new AABB(envelope[0] - 17, envelope[1] - 1, envelope[2] - 16,
            envelope[3] - 17, envelope[4] - 1, envelope[5] - 16));
        AABB changedNative = rail.expand(new AABB(-5000, -5000, -5000, 5000, 5000, 5000), pos);
        check(changedNative.f_82292_ == 5001.25 && changedNative.f_82288_ == -5000, "Other-mod native bounds changes must survive");
        ApprovedVisuals.updateAvailability(true);
        check(rail.expand(originalSmall, pos) != full, "Resource bake epoch must invalidate cached bounds");
        AABB noLift = receiver.expand(nativeBox, pos);
        check(noLift.f_82292_ == 1000, "Receiver native bounds must not acquire rail lift");
        AABB infinite = new AABB(Double.NEGATIVE_INFINITY, -1, -1, Double.POSITIVE_INFINITY, 1, 1);
        check(rail.expand(infinite, pos) == infinite, "Special native bounds must retain identity");
        ApprovedVisuals.updateAvailability(false);
        check(rail.expand(nativeBox, pos) == nativeBox, "Resource disable must restore original bounds");

        final int[] calls = {0};
        final RuntimeException failure = new RuntimeException("delegate failure");
        BlockEntityRenderer<BlockEntity> delegate = new BlockEntityRenderer<>() {
            @Override public void m_6922_(BlockEntity be, float partial, PoseStack stack, MultiBufferSource buffers, int light, int overlay) {
                check(be == null && partial == .25f && stack == null && buffers == null && light == 123 && overlay == 456, "Render arguments changed");
                calls[0]++;
                if (calls[0] == 2) throw failure;
            }
            @Override public boolean m_142756_(BlockEntity be, Vec3 camera) { return false; }
        };
        BlockEntityRenderer<BlockEntity> wrapper = ApprovedRendererBridge.wrap(delegate);
        check(ApprovedRendererBridge.wrap(wrapper) == wrapper, "Wrapper must be idempotent");
        check(wrapper.m_5932_(null), "Native global classification is required at section boundaries");
        check(wrapper.m_142163_() == 64, "Native 64-block distance changed");
        check(!wrapper.m_142756_(null, null), "Native distance predicate was not delegated");
        wrapper.m_6922_(null, .25f, null, null, 123, 456);
        check(calls[0] == 1, "Delegate must draw exactly once");
        try {
            wrapper.m_6922_(null, .25f, null, null, 123, 456);
            throw new AssertionError("Delegate failure swallowed");
        } catch (RuntimeException error) { check(error == failure, "Delegate exception changed"); }
        check(ApprovedRendererBridge.stats().get("wrappedDraws").equals(2L), "Native draw diagnostics incorrect");
        check(ApprovedRendererBridge.stats().get("active").equals(false), "Gate diagnostics incorrect");
        WeakControllerIndex<Object> index = new WeakControllerIndex<>();
        Object oldController = new Object(), replacement = new Object(), otherWorld = new Object();
        check(index.add(oldController) && !index.add(oldController), "Lifecycle registration must be idempotent");
        check(index.add(replacement) && index.add(otherWorld), "Lifecycle insertion failed");
        check(index.remove(oldController) && !index.remove(oldController), "Late removal must be idempotent");
        check(index.retain(controller -> controller == replacement).equals(java.util.List.of(replacement)), "World change must retain only the matching known controller");
        check(index.size() == 1, "World change retained stale lifecycle entries");
        check(index.retain(controller -> true).equals(java.util.List.of(replacement)), "Native renderer reset must preserve registered controllers without discovery");
        check(index.retain(controller -> false).isEmpty() && index.size() == 0, "Logout must clear the known controller index");
        System.out.println("NATIVE_REGRESSION_PASS: native/approved/translated-FX unions, 10000 cache reuses, positions, epoch, native changes, resource disable, scoped OBJ preparation on/off policy, global BER classification, distance, draw ownership, lifecycle index replacement/world/reset/logout and exceptions");
    }
}
