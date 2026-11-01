package dev.eldershi.dysoncompat.mixin;

import dev.eldershi.dysoncompat.client.RenderBoundsCache;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.phys.AABB;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity", remap = false)
public abstract class ReceiverRenderBoundsMixin {
    @Unique private final RenderBoundsCache createStyleDyson$bounds = new RenderBoundsCache(1, 0);

    @Inject(method = "getRenderBoundingBox()Lnet/minecraft/world/phys/AABB;", at = @At("RETURN"), cancellable = true, remap = false)
    private void createStyleDyson$renderBounds(CallbackInfoReturnable<AABB> result) {
        result.setReturnValue(createStyleDyson$bounds.expand(result.getReturnValue(), ((BlockEntity) (Object) this).m_58899_()));
    }
}
